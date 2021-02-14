import {NextApiRequest, NextApiResponse} from "next";
import {getSession} from "next-auth/client";
import {createClient} from "@supabase/supabase-js";
import {GameObj, LeagueObj} from "../../../utils/types";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    // check method
    if (req.method !== "POST") return res.status(405).json({message: "Invalid request method"});

    // check for missing fields
    if (!req.body.leagueId) return res.status(406).json({message: "Missing leagueId field"});
    if (!req.body.gameObjArray) return res.status(406).json({message: "Missing game object array"});
    // check auth
    const session = await getSession({req});
     if (!session && !req.body.code) return res.status(403).json({message: "You must have an access code or be logged in to upload games data."});

    const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);
    // check if league exists
    const {data: leagues, error: _} = await supabase
        .from<LeagueObj>("Leagues")
        .select("*")
        .eq("id", req.body.leagueId);
    if (leagues.length === 0) return res.status(404).json({message: "League not found"});

    // access code auth
    // if (req.body.code && req.body.code !== leagues[0].code) {
    //     return res.status(403).json({message: "Invalid access code."});
    // } else if (leagues[0].user_id !== session.userId) {
    //     return res.status(403).json({message: "You must be the league admin to upload games without a code."});
    // }

    // add any non existing players
    let players = leagues[0].players;
    req.body.gameObjArray.forEach(game => {
        const { player1, player2 } = game;
        if (!players.includes(player1)) players.push(player1)
        if (!players.includes(player2)) players.push(player2)
    })


    const {data: updatePlayers, error: updatePlayersError } = await supabase
        .from<LeagueObj>("Leagues")
        .update({ players: players })
        .eq("id", req.body.leagueId);
  
    // earliest games come first
    // if a is less (earlier) than b, a should come first
    req.body.gameObjArray.sort(function(a,b){
        // Turn your strings into dates, and then subtract them
        // to get a value that is either negative, positive, or zero.
        return +(new Date(a.date)) - +(new Date(b.date));
    });
          
    let uploadedGames = []
    // update games
    req.body.gameObjArray.forEach(game => {
        const { player1, player2, date, score1, score2 } = game;
        let lastPlayer1Game = uploadedGames.filter(g => (player1 === g.player1 || player1 === g.player2));
        let lastPlayer2Game = uploadedGames.filter(g => (player2 === g.player1 || player2 === g.player2));

        // if a previous game exists, get their previous ELO, else get 1000
        let elo1before = 1000;
        let elo2before = 1000;
        if (lastPlayer1Game.length > 0) {
            elo1before = lastPlayer1Game[lastPlayer1Game.length - 1].player1 === player1
                ? lastPlayer1Game[lastPlayer1Game.length - 1].elo1_after
                : lastPlayer1Game[lastPlayer1Game.length - 1].elo2_after;
        }
        if (lastPlayer2Game.length > 0) {
            elo2before = lastPlayer2Game[lastPlayer2Game.length - 1].player1 === player2
                ? lastPlayer2Game[lastPlayer2Game.length - 1].elo1_after
                : lastPlayer2Game[lastPlayer2Game.length - 1].elo2_after;
        }
    
        const expected1 = 1 / (1 + 10 ** ((elo2before - elo1before)/400));
        const expected2 = 1 / (1 + 10 ** ((elo1before - elo2before)/400));
        const elo1after = elo1before + 20 * (+(+score1 > +score2) - expected1);
        const elo2after = elo2before + 20 * (+(+score2 > +score1) - expected2);
        
        let gameToUpload = {
            player1: player1,
            score1: score1,
            elo1_before: elo1before,
            elo1_after: elo1after,
            player2: player2,
            score2: score2,
            elo2_before: elo2before,
            elo2_after: elo2after,
            date: date,
            league_id: req.body.leagueId,
            winner: score1 > score2 ? player1 : player2,
            loser: score1 > score2 ? player2 : player1,
        }
        uploadedGames.push(gameToUpload);
    })


    const {data, error} = await supabase
    .from<GameObj>("Games")
    .insert(uploadedGames);
    

    return res.status(200).json({});
}