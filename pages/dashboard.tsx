import React, {useEffect, useState} from "react";
import ElButton from "../components/ElButton";
import ElModal from "../components/ElModal";
import ElH2 from "../components/ElH2";
import ElH3 from "../components/ElH3";
import ElInput from "../components/ElInput";
import axios from "axios";
import {useRouter} from "next/router";
import useSWR, {responseInterface} from "swr";
import {fetcher} from "../utils/fetcher";
import {GetServerSideProps} from "next";
import {getSession} from "next-auth/client";
import {LeagueObj, SessionObj} from "../utils/types";
import ElH1 from "../components/ElH1";
import Link from "next/link";
import Skeleton from "react-loading-skeleton";
import ElInfoBox from "../components/ElInfoBox";
import ElNextSeo from "../components/ElNextSeo";

export default function Dashboard(props: {session: SessionObj}) {
    const router = useRouter();
    const [newLeagueOpen, setNewLeagueOpen] = useState<boolean>(false);
    const [name, setName] = useState<string>("");
    const [urlName, setUrlName] = useState<string>("");
    const [description, setDescription] = useState<string>("");
    const [newLeagueLoading, setNewLeagueLoading] = useState<boolean>(false);
    const [urlNameError, setUrlNameError] = useState<boolean>(false);
    const [urlNameNotUnique, setUrlNameNotUnique] = useState<boolean>(false);
    const [isPortalLoading, setIsPortalLoading] = useState<boolean>(false);

    const {data: leagues, error: _}: responseInterface<LeagueObj[], any> = useSWR(`/api/league/list?userId=${props.session.userId}`, fetcher);

    function onCreateLeague() {
        setNewLeagueLoading(true);

        axios.post("/api/league/new", {
            name: name,
            urlName: urlName,
            description: description || "",
        }).then(res => {
            if (res.data.notUnique) {
                setNewLeagueLoading(false);
                setUrlNameNotUnique(true);
            }
            else router.push(`/${urlName}`);
        }).catch(e => {
           console.log(e);
           setNewLeagueLoading(false);
        });
    }

    function onCancelCreateLeague() {
        setName("");
        setUrlName("");
        setDescription("");
        setNewLeagueOpen(false);
    }

    function redirectToBillingPortal() {
        setIsPortalLoading(true);

        axios.post("/api/billing/create-portal-session").then(res => {
            router.push(res.data.url);
        }).catch(e => {
            setIsPortalLoading(false);
            console.log(e);
        });
    }

    useEffect(() => {
        if (urlName !== encodeURIComponent(urlName) || urlName.includes("/") || ["dashboard", "signin", "about"].includes(urlName)) {
            setUrlNameError(true);
        } else {
            setUrlNameError(false);
        }
        setUrlNameNotUnique(false);
    }, [urlName]);

    const leaguesLeft = Math.max(leagues ? (props.session.numAllowedLeagues - leagues.length) : 0, 0);

    return (
        <div className="max-w-4xl mx-auto px-4">
            <ElNextSeo title="Your leagues"/>
            <div className="flex">
                <div>
                    <ElH1>Your leagues</ElH1>
                    <p className="text-lg">Share a league with your friends or your club to start tracking games and player ratings.</p>
                </div>
                <div className="ml-auto mt-12 flex-shrink-0">
                    <ElButton onClick={() => setNewLeagueOpen(true)}>
                        New league
                    </ElButton>
                </div>
            </div>
            {router.query.upgrade === "true" && (
                <ElInfoBox className="my-6">
                    <p className="text-lg">
                        {props.session.tier === "free" ? (
                            "Just upgraded your plan? It may take some time for your payment to be processed, and your account updated. Reload this page in a few minutes, or contact us at hello@eloleague.com if the problem persists."
                        ) : (
                            <span>Your account has been upgraded to a{props.session.tier === "individual" ? "n" : ""} <strong>{props.session.tier} plan</strong>.</span>
                        )}
                    </p>
                </ElInfoBox>
            )}
            <hr className="my-6"/>
            {leagues ? leagues.map(league => (
                <Link href={`/${league.url_name}`}>
                    <a className="w-full p-4 shadow-md my-4 block">
                        <ElH3>{league.name}</ElH3>
                        {league.description && <p>{league.description}</p>}
                        <p>{league.players ? league.players.length : 0} players</p>
                        <p>Access code: <span className="el-font-display">{league.code}</span></p>
                    </a>
                </Link>
            )) : (
                <div className="my-4">
                    <Skeleton count={3} className="h-24"/>
                </div>
            )}
            <ElModal isOpen={newLeagueOpen} closeModal={onCancelCreateLeague}>
                <ElH2>New league</ElH2>
                <p className="my-2">
                    Leagues left in your <b>{props.session.tier}</b> plan: {props.session.tier === "free" ?
                        (leaguesLeft + "/" + props.session.numAllowedLeagues)
                        : "unlimited"
                    }
                </p>
                <hr className="my-6"/>
                {((leagues && (leagues.length < props.session.numAllowedLeagues)) || props.session.tier !== "free")  ? (
                    <>
                        <ElH3>League name</ElH3>
                        <ElInput value={name} setValue={setName} placeholder="Example House Ping Pong League"/>
                        <hr className="my-6"/>
                        <ElH3>League URL name</ElH3>
                        <p className="my-2">Players will be able to view rankings and log games at this link.</p>
                        <div className="flex items-center">
                            <p className="text-lg mr-1">eloleague.com/</p>
                            <ElInput value={urlName} setValue={setUrlName} placeholder="example-ping-pong"/>
                        </div>
                        {urlNameError && (
                            <p className="my-2 text-red-500">Invalid URL name</p>
                        )}
                        {urlNameNotUnique && (
                            <p className="my-2 text-red-500">URL name already taken</p>
                        )}
                        <hr className="my-6"/>
                        <ElH3>League description (optional)</ElH3>
                        <ElInput
                            value={description}
                            setValue={setDescription}
                            placeholder="Informal ping pong rankings for Example House"
                        />
                        <hr className="my-6"/>
                        <ElButton onClick={onCreateLeague} isLoading={newLeagueLoading}>
                            Create
                        </ElButton>
                        <ElButton text={true} onClick={onCancelCreateLeague} disabled={newLeagueLoading}>
                            Cancel
                        </ElButton>
                    </>
                ) : (
                    <>
                        <p>Upgrade to an <b>Individual</b> or <b>Club</b> plan to create more leagues.</p>
                        <ElButton className="mt-4" href="/pricing">Start free trial</ElButton>
                    </>
                )}
            </ElModal>
            <hr className="my-6"/>
            <ElInfoBox>
                <div className="flex items-center">
                    <p className="text-lg">You are on a <b>{props.session.tier}</b> plan, with {props.session.tier === "free" ? leaguesLeft : "unlimited"} league{(leaguesLeft !== 1) ? "s" : ""} left.</p>
                    <ElButton
                        className="ml-auto"
                        href={props.session.tier === "free" ? "/pricing" : null}
                        onClick={props.session.tier === "free" ? null : redirectToBillingPortal}
                        isLoading={isPortalLoading}
                    >
                        {props.session.tier === "free" ? "Upgrade" : "Billing"}
                    </ElButton>
                </div>
            </ElInfoBox>
        </div>
    )
}

export const getServerSideProps: GetServerSideProps = async (context) => {
    const session = await getSession(context);

    if (!session) {
        context.res.setHeader("location", "/signin");
        context.res.statusCode = 302;
        context.res.end();
    }

    return {props: {session: session}};
};
