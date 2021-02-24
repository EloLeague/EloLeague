import {NextApiRequest, NextApiResponse} from "next";
import {createClient} from "@supabase/supabase-js";
import {GameObj, LeagueObj} from "../../../utils/types";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    // check method
    if (req.method !== "GET") return res.status(405).json({message: "Invalid request method"});

    // check params
    if (!req.query.leagueId) return res.status(406).json({message: "Missing league ID"});

    // check url_name uniqueness
    const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);
    const {data: league, error: _} = await supabase
        .from<LeagueObj>("Leagues")
        .select("players")
        .eq("id", req.query.leagueId)
        .single();

    async function getChangeInElo (day, playerName, elo) {
        const {data: priorGame, error: priorGameError} = await supabase 
            .from<GameObj>("Games")
            .select("*")
            .eq("league_id", +req.query.leagueId)
            .or(`player1.eq.${playerName},player2.eq.${playerName}`)
            .order("date", {ascending: false})
            .lte("date", new Date(Date.now() - day * 24 * 60 * 60 * 1000).toISOString())
            .limit(1);

        if (priorGame.length == 0) {
            return null;
        } else {
            const game = priorGame[0];
            if (playerName === game.player1) {
                return elo - game.elo1_after
            } else {
                return elo - game.elo2_after
            }
        }
    }

    let leagueStandings = [];
    if (league) {
         leagueStandings = await Promise.all(league.players.map(async player => {
            const {data: rating, error: ratingError} = await supabase
                .from<GameObj>("Games")
                .select("elo1_after, elo2_after, player1, player2")
                .eq("league_id", +req.query.leagueId)
                .or(`player1.eq.${player},player2.eq.${player}`)
                .order("id", {ascending: false})
                .limit(1);

            console.log(rating);

            let elo = 1000;
            if (rating.length > 0) {
                const { player1, player2, elo2_after, elo1_after } = rating[0];
                elo = player === player1 ? elo1_after : elo2_after;
            }

            const {data: wins, error: gameWinnerError} = await supabase
                .from<GameObj>("Games")
                .select("*", {count: "exact"})
                .eq("league_id", +req.query.leagueId)
                .eq("winner", player);

            const {data: losses, error: gameLoserError} = await supabase
                .from<GameObj>("Games")
                .select("*", {count: "exact"})
                .eq("league_id", +req.query.leagueId)
                .eq("loser", player);

            const changeInElo1 = await getChangeInElo(1, player, elo);
            const changeInElo7 = await getChangeInElo(14, player, elo);
            const changeInElo28 = await getChangeInElo(28, player, elo);

            return ({
                name: player,
                rating: elo,
                change: {
                    "24h": changeInElo1,
                    "7d":  changeInElo7,
                    "28d" :  changeInElo28
                },
                wins: wins.length,
                losses: losses.length,
            });
        }));

         leagueStandings.sort((a, b) => b.rating - a.rating);
    }

    return res.status(200).json(leagueStandings);
}