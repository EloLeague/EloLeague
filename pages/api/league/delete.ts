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

    if (req.body.code && req.body.code !== leagues[0].code) {
        return res.status(403).json({message: "Invalid access code."});
    } else if (leagues[0].user_id !== session.userId) {
        return res.status(403).json({message: "You must be the league admin to create a game without a code."});
    }

    // delete game 
    const {data: deleteLeague, error: deleteLeagueError} = await supabase 
        .from<LeagueObj>("Leagues")
        .delete()
        .match({ id: req.body.leagueId })


    const {data: deleteLeagueGames, error: deleteLeagueGamers} = await supabase 
        .from<GameObj>("Games")
        .delete()
        .match({ league_id: req.body.leagueId })

    return res.status(200).json({});
}