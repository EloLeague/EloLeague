import {NextApiRequest, NextApiResponse} from "next";
import {createClient} from "@supabase/supabase-js";
import {GameObj} from "../../../utils/types";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    // check method
    if (req.method !== "GET") return res.status(405).json({message: "Invalid request method"});

    // check params
    if (!req.query.leagueId || Array.isArray(req.query.leagueId)) return res.status(406).json({message: "Missing or invalid league ID"});

    // fetch games
    const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

    let query = supabase
        .from<GameObj>("Games")
        .select("*")
        .eq("league_id", req.query.leagueId);

    if (req.query.player) query = query.or(`player1.eq.${req.query.player},player2.eq.${req.query.player}`);

    const {data: games, error: _} = await query.order("id", {ascending: false});

    return res.status(200).json(games);
}