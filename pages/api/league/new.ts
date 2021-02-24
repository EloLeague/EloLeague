import {NextApiRequest, NextApiResponse} from "next";
import {getSession} from "next-auth/client";
import {makecode} from "../../../utils/makecode";
import {createClient} from "@supabase/supabase-js";
import {LeagueObj, UserObj} from "../../../utils/types";
import xkpasswd from "xkpasswd";
import pwwords from "../../../utils/pwwords";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    // check method
    if (req.method !== "POST") return res.status(405).json({message: "Invalid request method"});

    // check for missing fields
    if (!req.body.name) return res.status(406).json({message: "Missing name field"});
    if (!req.body.urlName) return res.status(406).json({message: "Missing urlName field"});

    // check auth
    const session = await getSession({req});
    if (!session) return res.status(403).json({message: "You must be logged in to create a league."});

    // check url_name uniqueness
    const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);
    const {data: existingLeague, error: _} = await supabase
        .from<LeagueObj>("Leagues")
        .select("*")
        .eq("url_name", req.body.urlName);
    if (existingLeague.length > 0) return res.status(200).json({notUnique: true});

    // create league
    const name = req.body.name;
    const url_name = req.body.urlName;
    const code = xkpasswd({wordList: pwwords, separators: "-"});

    const user_id = session.userId;
    const description = req.body.description || "";

    const {data: userData, error: userError} = await supabase
        .from<UserObj>("Users")
        .select("leagues")
        .eq("id", user_id)
        .single();

    if (!userData) return res.status(500).json({message: "User not found for given userId"});

    const {data: leagueData, error: leagueError} = await supabase
        .from<LeagueObj>("Leagues")
        .insert([
            {
                name: name,
                url_name: url_name,
                code: code,
                user_id: user_id,
                description: description,
            }
        ]);

    const newUserLeagues = [...userData.leagues, leagueData[0].id];

    const {data: userUpdateData, error: userUpdateError} = await supabase
        .from<UserObj>("Users")
        .update({ leagues: newUserLeagues })
        .eq("id", user_id);

    return res.status(200).json({league: leagueData});
}