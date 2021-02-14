import {GetServerSideProps} from "next";
import {GameObj, LeagueObj, PlayerStandingObj, SessionObj} from "../../utils/types";
import {getSession} from "next-auth/client";
import {createClient} from "@supabase/supabase-js";
import {useRouter} from "next/router";
import ElH1 from "../../components/ElH1";
import ElButton from "../../components/ElButton";
import React, {useState} from "react";
import ElModal from "../../components/ElModal";
import ElH2 from "../../components/ElH2";
import ElH3 from "../../components/ElH3";
import ElInput from "../../components/ElInput";
import axios, {AxiosError, AxiosResponse} from "axios";
import {BiArrowBack, BiInfoCircle} from "react-icons/bi";
import Link from "next/link";
import useSWR, {responseInterface} from "swr";
import {fetcher} from "../../utils/fetcher";
import {format} from "date-fns";
import Skeleton from "react-loading-skeleton";
import Select from "react-select";
import ElFooterCTA from "../../components/ElFooterCTA";
import ElInfoBox from "../../components/ElInfoBox";
import ElNextSeo from "../../components/ElNextSeo";
import ElTab from "../../components/ElTab";

export default function LeagueIndex({league, session}: {league: LeagueObj, session: SessionObj}) {
    const router = useRouter();

    const isAdmin = session && (+league.user_id === +session.userId);
    const [newGameOpen, setNewGameOpen] = useState<boolean>(false);
    const [player1, setPlayer1] = useState<string>("");
    const [score1, setScore1] = useState<number>(0);
    const [player2, setPlayer2] = useState<string>("");
    const [score2, setScore2] = useState<number>(0);
    const [code, setCode] = useState<string>("");
    const [csvImportText, setCsvImportText] = useState<string>("");
    const [newGameLoading, setNewGameLoading] = useState<boolean>(false);
    const [newPlayerOpen, setNewPlayerOpen] = useState<boolean>(false);
    const [newPlayerLoading, setNewPlayerLoading] = useState<boolean>(false);
    const [newPlayerName, setNewPlayerName] = useState<string>("");
    const [deleteLeagueOpen, setDeleteLeagueOpen] = useState<boolean>(false);
    const [deleteLeagueLoading, setDeleteLeagueLoading] = useState<boolean>(false);
    const [gameIteration, setGameIteration] = useState<number>(0);
    const [playerIteration, setPlayerIteration] = useState<number>(0);
    const [unauth, setUnauth] = useState<boolean>(false);
    const [unauthMessage, setUnauthMessage] = useState<string>("");
    const [deleteGameOpen, setDeleteGameOpen] = useState<boolean>(false);
    const [deleteGameLoading, setDeleteGameLoading] = useState<boolean>(false);
    const [selectedGame, setSelectedGame] = useState<number>(null);
    const [newGameTab, setNewGameTab] = useState<"single" | "multiple" | "bulk">("single");
    const [bulkGames, setBulkGames] = useState<{
        player1: string,
        score1: number,
        player2: string,
        score2: number,
    }[]>(null);
    const {data: games, error: gamesError}: responseInterface<GameObj[], any> = useSWR(`/api/game/list?leagueId=${league.id}&iter=${gameIteration}`, fetcher);
    const {data: playerRatings, error: playerRatingsError}: responseInterface<PlayerStandingObj[], any> = useSWR(`api/league/standings?leagueId=${league.id}&?iter=${playerIteration}`, fetcher);

    function onSubmitGame() {
        setNewGameLoading(true);
        setUnauth(false);

        if (newGameTab === "single") {
            axios.post("/api/game/new", {
                player1: player1,
                score1: score1.toString(),
                player2: player2,
                score2: score2.toString(),
                code: code,
                leagueId: league.id,
            }).then((res: AxiosResponse) => {
                afterSubmit();
            }).catch((e: AxiosError) => {
                handleSubmitError(e);
            });
        } else {
            let games = [];
            if (newGameTab === "bulk") {
                const lines = csvImportText.split("\n");
                lines.forEach(line => {
                    const values = line.split(",");
                    const game = {
                        date: values[0],
                        player1: values[1],
                        player2: values[2],
                        score1: +values[3],
                        score2: +values[4],
                    };
                    games.push(game);
                });
            } else {
                games = bulkGames.map(game => ({date: new Date().toISOString(), ...game}));
            }

            axios.post("/api/game/upload", {
                gameObjArray: games,
                leagueId: league.id
            }).then(() => {
                afterSubmit();
            }).catch((e: AxiosError) => {
                handleSubmitError(e);
            });
        }        
    }
    
    function afterSubmit() {
        setNewGameLoading(false);
        setGameIteration(gameIteration + 1);
        setPlayerIteration(playerIteration + 1);
        onCancelSubmitGame();
    }
    
    function handleSubmitError(e: AxiosError) {
        setNewGameLoading(false);
        if (e.response.status === 403) {
            setUnauth(true);
            setUnauthMessage(e.response.data.message)
        }
        console.log(e);
    }

    function onCancelSubmitGame() {
        setPlayer1("");
        setScore1(0);
        setPlayer2("");
        setScore2(0);
        setCode("");
        setUnauth(false);
        setUnauthMessage("");
        setCsvImportText("");
        setNewGameOpen(false);
    }

    function onSubmitPlayer() {
        setNewPlayerLoading(true);
        setUnauth(false);

        axios.post("/api/league/player", {
            leagueId: league.id,
            name: newPlayerName,
            code: code
        }).then(() => {
            // change dummy param to trigger standings re-query
            setPlayerIteration(playerIteration + 1);
            setNewPlayerLoading(false);
            onCancelSubmitPlayer();
        }).catch((e: AxiosError) => {
            setNewPlayerLoading(false);
            if (e.response.status === 403) {
                setUnauthMessage(e.response.data.message);
                setUnauth(true);
            }
            console.log(e);
        });
    }

    function onCancelSubmitPlayer() {
        setNewPlayerOpen(false);
        setNewPlayerName("");
        setUnauth(false);
        setUnauthMessage("");
        setCode("");
    }

    function onDeleteGame() {
        setDeleteGameLoading(true);

        axios.delete("/api/game/delete", {
            data: {
                code: code || "",
                leagueId: league.id,
                gameId: selectedGame,
            }
        }).then(() => {
            setDeleteGameLoading(false);
            onDeleteCancel();
            setGameIteration(gameIteration + 1);
            setPlayerIteration(playerIteration + 1);
        }).catch(e => {
            console.log(e);
            if (e.response.status === 403) {
                setUnauthMessage(e.response.data.message);
                setUnauth(true);
            }
            setDeleteGameLoading(false);
        });
    }

    function onDeleteCancel() {
        setDeleteGameOpen(false);
        setCode("");
        setSelectedGame(null);
        setUnauth(false);
        setUnauthMessage("");
    }

    function onCancelDeleteLeague() {
        setDeleteLeagueOpen(false);
    }

    function onDeleteLeague() {
        setDeleteLeagueLoading(true);
        axios.delete("/api/league/delete", {
            data: {
                leagueId: league.id,
                accessCode: code || "",
            }
        }).then(() => {
            setDeleteLeagueLoading(false);
            onCancelDeleteLeague();
            router.push("/dashboard");
        }).catch(e => {
            console.log(e);
            setDeleteLeagueLoading(false);
        });
    }

    const thClass = "font-normal pb-2";
    const tdClass = "py-4 border-b";

    return (
        <div className="max-w-4xl mx-auto px-4 pb-12">
            <ElNextSeo title={"League: " + league.name}/>
            {isAdmin && (
                <Link href="/dashboard">
                    <a className="flex items-center mt-8">
                        <BiArrowBack/>
                        <span className="ml-4">Back to dashboard</span>
                    </a>
                </Link>
            )}
            
            <div className="flex items-baseline">
                <div>
                    <ElH1>League: {league.name}</ElH1>
                    <p className="text-lg">{league.description || ""}</p>
                </div>
                {
                    isAdmin && <div className="ml-auto mb-6">
                        <ElButton onClick={() => setDeleteLeagueOpen(true)}>
                            Delete League
                        </ElButton>
                        <ElModal isOpen={deleteLeagueOpen} closeModal={onCancelDeleteLeague}>
                            <ElH2>Delete League {league.name}</ElH2>
                            <p className="mt-8 mb-8">Are you sure you want to delete league {league.name}? This action cannot be undone.</p>
                            <ElButton onClick={onDeleteLeague} isLoading={deleteLeagueLoading}>
                                Delete
                            </ElButton>
                            <ElButton text={true} onClick={onCancelDeleteLeague} disabled={deleteLeagueLoading}>
                                Cancel
                            </ElButton>
                        </ElModal>
                    </div>
                }
            </div>
            
            {isAdmin ? (
                <ElInfoBox className="my-4">
                    <div className="flex items-center">
                        <BiInfoCircle className="flex-shrink-0"/>
                        <p className="text-lg ml-4">
                            You are an admin of this league. Share the current url ({`eloleague.com/${league.url_name}`}) and access code (<span className="el-font-display">{league.code}</span>) with players for them to log games.
                        </p>
                    </div>
                </ElInfoBox>
            ) : (
                <p className="text-lg">Ask the league admin for the access code to log games or add new players.</p>
            )}
            <hr className="my-6"/>
            <div className="md:flex -mx-4">
                <div className="md:w-1/2 mx-4 pb-16">
                    <div className="flex items-center">
                        <ElH3>Player rankings</ElH3>
                        <div className="ml-auto">
                            <ElButton onClick={() => setNewPlayerOpen(true)}>
                                Add new player
                            </ElButton>
                            <ElModal isOpen={newPlayerOpen} closeModal={onCancelSubmitPlayer}>
                                <ElH2>Add new player</ElH2>
                                <hr className="my-6"/>
                                <ElH3>Player name</ElH3>
                                <ElInput value={newPlayerName} setValue={setNewPlayerName}/>
                                <hr className="my-6"/>
                                {!isAdmin && (
                                    <>
                                        <ElH3>Access code</ElH3>
                                        <p>Ask your league admin for the access code.</p>
                                        <ElInput value={code} setValue={setCode}/>
                                        {unauth && (
                                            <p className="my-2 text-red-500">{unauthMessage}</p>
                                        )}
                                        <hr className="my-6"/>
                                    </>
                                )}
                                <ElButton onClick={onSubmitPlayer} isLoading={newPlayerLoading}>
                                    Add
                                </ElButton>
                                <ElButton text={true} onClick={onCancelSubmitPlayer} disabled={newPlayerLoading}>
                                    Cancel
                                </ElButton>
                            </ElModal>
                        </div>
                    </div>
                    <table className="w-full mt-6">
                        <thead className="text-gray-400 text-left border-b-2">
                            <th className={thClass}>Rank</th>
                            <th className={thClass}>Player</th>
                            <th className={thClass}>Elo</th>
                            <th className={thClass}>Wins</th>
                            <th className={thClass}>Losses</th>
                        </thead>
                        <tbody>
                            {playerRatings && playerRatings.map((playerObj, i) => (
                                <tr>
                                    {[i + 1, playerObj.name, Math.round(playerObj.rating), playerObj.wins || 0, playerObj.losses || 0].map(stat => (
                                        <td className={tdClass}>
                                            <Link href={`/${league.url_name}/${playerObj.name}`}><a>
                                                {stat}
                                            </a></Link>
                                        </td>
                                    ))}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    {!playerRatings && (
                        <div className="my-4">
                            <Skeleton count={3} className="h-14"/>
                        </div>
                    )}
                    {playerRatings && playerRatings.length === 0 && (isAdmin ? (
                        <p className="opacity-50 mt-8">
                            You haven't added any players yet. Hit the "Add new player" button to add players, or send the link to this page and the league access code to your friends!
                        </p>
                    ) : (
                        <p className="opacity-50 mt-8">No players have been added to this league.</p>
                    ))}
                </div>
                <div className="md:w-1/2 mx-4 pb-16">
                    <div className="flex items-center">
                        <ElH3>Latest games</ElH3>
                        <div className="ml-auto">
                            <ElButton onClick={() => setNewGameOpen(true)}>
                                Log new game
                            </ElButton>
                            <ElModal isOpen={newGameOpen} closeModal={onCancelSubmitGame}>
                                <ElH2>Log new game</ElH2>
                                <div className="my-6 flex">
                                    <ElTab selected={newGameTab === "single"} onClick={() => setNewGameTab("single")}>Single</ElTab>
                                    {/*<ElTab selected={newGameTab === "multiple"} onClick={() => setNewGameTab("multiple")}>Multiple</ElTab>*/}
                                    <ElTab selected={newGameTab === "bulk"} onClick={() => setNewGameTab("bulk")}>Bulk</ElTab>
                                </div>
                                {newGameTab === "single" ? (
                                    <>
                                        <div className="flex -mx-2">
                                            <div className="mx-2 w-1/2">
                                                <ElH3>Player 1</ElH3>
                                                <Select
                                                    value={{label: player1, value: player1}}
                                                    onChange={selected => {
                                                        setPlayer1(selected.value);
                                                    }}
                                                    options={playerRatings ? playerRatings.map(player => ({label: player.name, value: player.name})): []}
                                                    filterOption={label => label !== player2}
                                                    className="w-full my-2"
                                                />
                                            </div>
                                            <div className="mx-2 w-1/2">
                                                <ElH3>P1 score</ElH3>
                                                <ElInput value={score1} setValue={setScore1} type="number"/>
                                            </div>
                                        </div>
                                        <hr className="my-6"/>
                                        <div className="flex -mx-2">
                                            <div className="mx-2 w-1/2">
                                                <ElH3>Player 2</ElH3>
                                                <Select
                                                    value={{label: player2, value: player2}}
                                                    onChange={selected => setPlayer2(selected.value)}
                                                    options={playerRatings ? playerRatings.map(player => ({label: player.name, value: player.name})) : []}
                                                    filterOption={({label}) => label !== player1}
                                                    className="w-full my-2"
                                                />
                                            </div>
                                            <div className="mx-2 w-1/2">
                                                <ElH3>P2 score</ElH3>
                                                <ElInput value={score2} setValue={setScore2} type="number"/>
                                            </div>
                                        </div>
                                    </>
                                ) : newGameTab === "multiple" ? (
                                    <>
                                        {bulkGames.map(game => (
                                            <div className="flex">

                                            </div>
                                        ))}
                                    </>
                                ) : (
                                    <>
                                        <p className="my-6">
                                            Enter each game on a new line, following this format: <code>date (ISO string),player1,player2,score1,score2</code>
                                        </p>
                                        <textarea
                                            className="w-full p-2 border"
                                            style={{minWidth: 300}}
                                            placeholder="Enter your games here"
                                            value={csvImportText}
                                            rows={5}
                                            onChange={(e) => setCsvImportText(e.target.value)}
                                        />
                                    </>
                                )}
                                <hr className="my-6"/>
                                {!isAdmin && (
                                    <>
                                        <ElH3>Access code</ElH3>
                                        <p>Ask your league admin for the access code.</p>
                                        <ElInput value={code} setValue={setCode}/>
                                        {unauth && (
                                            <p className="my-2 text-red-500">{unauthMessage}</p>
                                        )}
                                        <hr className="my-6"/>
                                    </>
                                )}
                                <ElButton onClick={onSubmitGame} isLoading={newGameLoading}>
                                    Add
                                </ElButton>
                                <ElButton text={true} onClick={onCancelSubmitGame} disabled={newGameLoading}>
                                    Cancel
                                </ElButton>
                            </ElModal>
                        </div>
                    </div>
                    {games ? (games.length > 0 ? (
                        games.slice(0, 20).map((game, i, a) => (
                            <>
                                {(i === 0 || format(new Date(game.date), "yyyy-MM-dd") !== format(new Date(a[i-1].date), "yyyy-MM-dd")) && (
                                    <p className="border-b-2 pb-2 mt-6 text-gray-400">{format(new Date(game.date), "EEEE, MMMM d, yyyy")}</p>
                                )}
                                <div className="py-4 border-b">
                                    <p className="text-sm opacity-50 text-center">
                                        {format(new Date(game.date), "h:mm a")}
                                        <span> | </span>
                                        <button className="underline" onClick={() => {
                                            setSelectedGame(game.id);
                                            setDeleteGameOpen(true);
                                        }}>Delete</button>
                                    </p>
                                    <div className="flex items-center">
                                        <div className="w-1/3">
                                            <Link href={`/${league.url_name}/${game.player1}`}>
                                                <a className={(game.score1 > game.score2) ? "font-bold" : "opacity-50"}>
                                                    {game.player1}
                                                </a>
                                            </Link>
                                            <p className="text-sm opacity-75">{Math.round(game.elo1_before)} → {Math.round(game.elo1_after)}</p>
                                        </div>
                                        <p className="text-xl w-1/3 text-center">
                                            <span className={(game.score1 > game.score2) ? "font-bold" : "opacity-50"}>{game.score1}</span>
                                            <span className="opacity-25"> | </span>
                                            <span className={(game.score2 > game.score1) ? "font-bold" : "opacity-50"}>{game.score2}</span>
                                        </p>
                                        <div className="text-right w-1/3">
                                            <Link href={`/${league.url_name}/${game.player2}`}>
                                                <a className={(game.score2 > game.score1) ? "font-bold" : "opacity-50"}>
                                                    {game.player2}
                                                </a>
                                            </Link>
                                            <p className="text-sm opacity-75">{Math.round(game.elo2_before)} → {Math.round(game.elo2_after)}</p>
                                        </div>
                                    </div>
                                </div>
                            </>
                        ))
                    ) : isAdmin ? (
                        <p className="opacity-50 mt-8">You haven't logged any games yet. Hit the "Log new game" button to log games, or send the link to this page and the league access code to your friends!</p>
                    ) : (
                        <p className="opacity-50 mt-8">No games have been logged in this league.</p>
                    )) : (
                        <div className="my-4">
                            <Skeleton count={3} className="h-20"/>
                        </div>
                    )}
                </div>
                <ElModal isOpen={deleteGameOpen} closeModal={onDeleteCancel}>
                    <ElH2>Delete game</ElH2>
                    <p className="my-6">Are you sure you want to delete this game?</p>
                    <hr className="my-6"/>
                    {!isAdmin && (
                        <>
                            <ElH3>Access code</ElH3>
                            <p>Ask your league admin for the access code.</p>
                            <ElInput value={code} setValue={setCode}/>
                            {unauth && (
                                <p className="my-2 text-red-500">{unauthMessage}</p>
                            )}
                            <hr className="my-6"/>
                        </>
                    )}
                    <ElButton onClick={onDeleteGame} isLoading={deleteGameLoading}>
                        Delete
                    </ElButton>
                    <ElButton text={true} onClick={onDeleteCancel} disabled={deleteGameLoading}>
                        Cancel
                    </ElButton>
                </ElModal>
            </div>
            <ElFooterCTA noDisplay={!!(isAdmin || session)}/>
        </div>
    );
}

export const getServerSideProps: GetServerSideProps = async (context) => {
    // get user session
    const session = await getSession(context);

    // load in league data or throw 404
    const url = context.query.league;

    const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

    const {data: thisLeague, error: _} = await supabase
        .from<LeagueObj>("Leagues")
        .select("*")
        .eq("url_name", url);
    
    if (thisLeague.length === 0) {
        return {notFound: true};
    }

    let returnLeague = {...thisLeague[0]};

    if (!session || returnLeague.user_id !== session.userId) delete returnLeague.code;
    return {props: {league: thisLeague[0], session: session}};
};