import {NextApiRequest, NextApiResponse} from "next";
import {getSession} from "next-auth/client";
import {createClient} from "@supabase/supabase-js";
import {GameObj, LeagueObj} from "../../../utils/types";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    // check method
    if (req.method !== "POST") return res.status(405).json({message: "Invalid request method"});

    // check for missing fields
    if (!req.body.leagueId) return res.status(406).json({message: "Missing leagueId field"});
    if (!req.body.player1) return res.status(406).json({message: "Missing player1 field"});
    if (!req.body.player2) return res.status(406).json({message: "Missing player2 field"});
    if (!req.body.score1) return res.status(406).json({message: "Missing score1 field"});
    if (!req.body.score2) return res.status(406).json({message: "Missing score2 field"});

    // check auth
    const session = await getSession({req});
    if (!session && !req.body.code) return res.status(403).json({message: "You must have an access code or be logged in to create a league."});

    const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);
    const {data: leagues, error: _} = await supabase
        .from<LeagueObj>("Leagues")
        .select("*")
        .eq("id", req.body.leagueId);
    if (leagues.length === 0) return res.status(404).json({message: "League not found"});

    const validCode = req.body.code && req.body.code !== leagues[0].code;
    const validSession = session && (leagues[0].user_id !== session.userId);

    if (!(validCode || validSession)) return res.status(403).json({message: "Invalid access code or authorization."});

    // create game

    // calculate Elos
    const {data: lastPlayer1Game, error: lastPlayer1GameError} = await supabase
        .from<GameObj>("Games")
        .select("*")
        .eq("league_id", req.body.leagueId)
        .or(`player1.eq.${req.body.player1}, player2.eq.${req.body.player1}`)
        .order("date", {ascending: false})
        .limit(1);

    const {data: lastPlayer2Game, error: lastPlayer2GameError} = await supabase
        .from<GameObj>("Games")
        .select("*")
        .eq("league_id", req.body.leagueId)
        .or(`player1.eq.${req.body.player2}, player2.eq.${req.body.player2}`)
        .order("date", {ascending: false})
        .limit(1);

    let elo1before = 1000;
    let elo2before = 1000;
    if (lastPlayer1Game.length > 0) {
        elo1before = lastPlayer1Game[0].player1 === req.body.player1
            ? lastPlayer1Game[0].elo1_after
            : lastPlayer1Game[0].elo2_after;
    }
    if (lastPlayer2Game.length > 0) {
        elo2before = lastPlayer2Game[0].player1 === req.body.player2
            ? lastPlayer2Game[0].elo1_after
            : lastPlayer2Game[0].elo2_after;
    }

    const expected1 = 1 / (1 + 10 ** ((elo2before - elo1before)/400));
    const expected2 = 1 / (1 + 10 ** ((elo1before - elo2before)/400));
    const elo1after = elo1before + 20 * (+(+req.body.score1 > +req.body.score2) - expected1);
    const elo2after = elo2before + 20 * (+(+req.body.score2 > +req.body.score1) - expected2);

    const {data, error} = await supabase
        .from<GameObj>("Games")
        .insert([
            {
                player1: req.body.player1,
                score1: req.body.score1,
                elo1_before: elo1before,
                elo1_after: elo1after,
                player2: req.body.player2,
                score2: req.body.score2,
                elo2_before: elo2before,
                elo2_after: elo2after,
                league_id: req.body.leagueId,
                winner: (+req.body.score1 > +req.body.score2) ? req.body.player1 : req.body.player2,
                loser: (+req.body.score1 > +req.body.score2) ? req.body.player2 : req.body.player1,
            }
        ]);

    return res.status(200).json({game: data});
}