import {GetServerSideProps} from "next";
import {getSession} from "next-auth/client";
import {createClient} from "@supabase/supabase-js";
import {GameObj, LeagueObj, SessionObj, UserObj} from "../../utils/types";
import useSWR, {responseInterface} from "swr";
import {fetcher} from "../../utils/fetcher";
import React from "react";
import Link from "next/link";
import {BiArrowBack} from "react-icons/bi";
import ElH1 from "../../components/ElH1";
import ElH3 from "../../components/ElH3";
import ElH2 from "../../components/ElH2";
import Skeleton from "react-loading-skeleton";
import ElRatingGraph from "../../components/ElRatingGraph";
import ElHeadToHeadsTable from "../../components/ElHeadToHeadsTable";
import {sampleChartData, sampleHeadToHeads} from "../../utils/sampleData";
import ElButton from "../../components/ElButton";
import ElFooterCTA from "../../components/ElFooterCTA";
import ElInfoBox from "../../components/ElInfoBox";
import ElNextSeo from "../../components/ElNextSeo";

export default function Player({league, leagueTier, player, session}: {
    league: LeagueObj,
    leagueTier: "free" | "individual" | "club",
    player: string,
    session: SessionObj,
}) {
    const isAdmin = session && (+league.user_id === +session.userId);
    const {data: games, error: gamesError}: responseInterface<GameObj[], any> = useSWR(`/api/game/list?leagueId=${league.id}&player=${player}`, fetcher);
    // earliest games come first
    // if a is less (earlier) than b, a should come first
    let filteredGames = [];

    if (games && games.length > 0) {
        games.sort(function(a,b){
            // Turn your strings into dates, and then subtract them
            // to get a value that is either negative, positive, or zero.
            return +(new Date(a.date)) - +(new Date(b.date));
        });

        for (let i = 0; i < games.length - 1; i++) {
            let currentGameDate = new Date(games[i].date);
            let nextGameDate = new Date(games[i + 1].date);
            if (currentGameDate.getFullYear() !== nextGameDate.getFullYear() ||
                currentGameDate.getMonth() !== nextGameDate.getMonth() || 
                currentGameDate.getDate() !== nextGameDate.getDate()) {
                    filteredGames.push(games[i])
                }
        }
        filteredGames.push(games[games.length - 1]);
    }

    const chartData = (games && games.length > 0) ? filteredGames.map(game => ({
        rating: game.player1 === player ? game.elo1_after : game.elo2_after,
        date: new Date(game.date).getTime(),
    })) : null;
    
    const uniqueOpponents = (games && games.length > 0) && games
        .map(game => game.player1 === player ? game.player2 : game.player1)
        .filter((thisPlayer, i, a) => i === a.findIndex(d => d === thisPlayer));
    
    const headToHeads = uniqueOpponents && uniqueOpponents.map(opponent => {
        const gamesAgainst = games.filter(game => [game.player1, game.player2].includes(opponent));
        const wins = gamesAgainst.filter(game => game.winner === player).length;
        const losses = gamesAgainst.filter(game => game.loser === player).length;
        return {
            name: opponent,
            wins: wins,
            losses: losses,
        }
    });

    return (
        <div className="max-w-4xl mx-auto px-4 pb-12">
            <ElNextSeo title={"Player: " + player}/>
            <Link href={`/${league.url_name}`}>
                <a className="flex items-center mt-8">
                    <BiArrowBack/>
                    <span className="ml-4">Back to {league.name}</span>
                </a>
            </Link>
            <ElH1>Player: {player}</ElH1>
            <hr className="my-6"/>
            {leagueTier === "club" ? (
                <div className="md:flex -mx-4">
                    <div className="md:w-1/2 mx-4 pb-16">
                        <ElH3>Rating history</ElH3>
                        {chartData ? (
                            <ElRatingGraph chartData={chartData}/>
                        ) : (
                            <div className="my-4">
                                <Skeleton count={1} style={{height: 400}}/>
                            </div>
                        )}
                    </div>
                    <div className="md:w-1/2 mx-4 pb-16">
                        <ElH3>Head to heads</ElH3>
                        <ElHeadToHeadsTable headToHeads={headToHeads} player={player} leagueUrl={league.url_name}/>
                        {!headToHeads && (
                            <div className="my-4">
                                <Skeleton count={3} className="h-14"/>
                            </div>
                        )}
                    </div>
                </div>
            ) : (
                <ElInfoBox>
                    <ElH2>Upgrade for player profiles</ElH2>
                    {isAdmin ? (
                        <div className="flex items-center">
                            <p className="mt-4 text-lg">Upgrade to a <b>club tier account</b> to enable player rating histories, head to head records, and more.</p>
                            <ElButton className="ml-4 flex-shrink-0" href="/pricing">{(session && session.trialUsed) ? "Upgrade" : "Start free trial"}</ElButton>
                        </div>
                    ) : (
                        <p className="mt-4 text-lg">Ask your league admin to upgrade to a <b>club tier account</b> to enable player rating histories, head to head records, and more.</p>
                    )}
                    <hr className="my-4"/>
                    <div className="md:flex -mx-4">
                        <div className="md:w-1/2 mx-4 pb-16 md:pb-0">
                            <ElH3>Rating history (sample data)</ElH3>
                            <div className="mt-4 pr-4 border shadow-md bg-white">
                                <ElRatingGraph chartData={sampleChartData}/>
                            </div>
                        </div>
                        <div className="md:w-1/2 mx-4 pb-16 md:pb-0">
                            <ElH3>Head to heads (sample data)</ElH3>
                            <div className="mt-4 px-4 mb-2 border shadow-md bg-white">
                                <ElHeadToHeadsTable headToHeads={sampleHeadToHeads} player="Han"/>
                            </div>
                        </div>
                    </div>
                </ElInfoBox>
            )}
            <ElFooterCTA noDisplay={!!(isAdmin || session)}/>
        </div>
    )

}

export const getServerSideProps: GetServerSideProps = async (context) => {
    // get user session
    const session = await getSession(context);

    const urlLeague = context.query.league;
    const urlPlayer = context.query.player;

    if (Array.isArray(urlLeague) || Array.isArray(urlPlayer)) {
        return {notFound: true};
    }

    const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

    const {data: thisLeague, error: thisLeagueError} = await supabase
        .from<LeagueObj>("Leagues")
        .select("*")
        .eq("url_name", urlLeague);

    if (thisLeague.length === 0 || !thisLeague[0].players.includes(urlPlayer)) {
        return {notFound: true};
    }

    let returnLeague = {...thisLeague[0]};
    if (!session || returnLeague.user_id !== session.userId) delete returnLeague.code;

    const {data: thisLeagueTier, error: thisLeagueTierError} = await supabase
        .from<UserObj>("Users")
        .select("tier")
        .eq("id", thisLeague[0].user_id);

    return {props: {league: thisLeague[0], leagueTier: thisLeagueTier[0].tier, player: urlPlayer, session: session}};
};