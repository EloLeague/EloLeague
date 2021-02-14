import {NextApiRequest, NextApiResponse} from "next";
import {getSession} from "next-auth/client";
import {createClient} from "@supabase/supabase-js";
import {GameObj, LeagueObj} from "../../../utils/types";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    // check method
    if (req.method !== "DELETE") return res.status(405).json({message: "Invalid request method"});

    // check for missing fields
    if (!req.body.leagueId) return res.status(406).json({message: "Missing leagueId field"});

    // check auth
    const session = await getSession({req});
    if (!session && !req.body.code) return res.status(403).json({message: "You must have an access code or be logged in to create a league."});

    const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);
    const {data: leagues, error: leagueError} = await supabase
        .from<LeagueObj>("Leagues")
        .select("*")
        .eq("id", req.body.leagueId);
    if (leagues.length === 0) return res.status(404).json({message: "League not found"});

    const validCode = req.body.code && req.body.code === leagues[0].code;
    const validSession = session && (leagues[0].user_id === session.userId);

    if (!(validCode || validSession)) return res.status(403).json({message: "Invalid access code or authorization."});

    // delete game 
    const {data: deleteGame, error: deleteGameError} = await supabase 
        .from<GameObj>("Games")
        .delete()
        .match({ id: req.body.gameId })

    // recalculate ELOs

    const {data: allGames, error: allGamesError} = await supabase 
        .from<GameObj>("Games")
        .select("*")
        .eq("league_id", +req.body.leagueId)
        .order("id", {ascending: true})
    
    // games are sorted by id ascending
    // earliest id's come first, latest id's come last 
    for (let i = 0; i < allGames.length; i++) {
            let game = allGames[i];
            if (game.id > deleteGame[0].id) {
                // get the current games players
                let player1 = game.player1
                let player2 = game.player2 

                // get the current players previous games by filtering the all games array
                //const filterFunc = (g) => 
                let lastPlayer1Game = allGames.filter(g => (player1 === g.player1 || player1 === g.player2) && g.id < game.id);
                let lastPlayer2Game = allGames.filter(g => (player2 === g.player1 || player2 === g.player2) && g.id < game.id);

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

                // calculate the exoected elo for each player after this game occurs
                const expected1 = 1 / (1 + 10 ** ((elo2before - elo1before)/400));
                const expected2 = 1 / (1 + 10 ** ((elo1before - elo2before)/400));
                const elo1after = elo1before + 20 * (+(+game.score1 > +game.score2) - expected1);
                const elo2after = elo2before + 20 * (+(+game.score2 > +game.score1) - expected2);
                
                // set this games fields
                game.elo1_before = elo1before
                game.elo2_before = elo2before
                game.elo1_after = elo1after
                game.elo2_after = elo2after
                
                // update game with new elo's
                const {data: updateGame, error: updateGameError} = await supabase 
                    .from<GameObj>("Games")
                    .update({ 
                        elo1_before: elo1before,
                        elo1_after: elo1after, 
                        elo2_before: elo2before,
                        elo2_after: elo2after
                    })
                    .match({ id: "" + game.id })
            }
                
    }

    return res.status(200).json({});
}