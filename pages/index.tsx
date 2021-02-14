import {useSession} from "next-auth/client";
import Head from "next/head";
import React from "react";
import {NextSeo} from "next-seo";
import { ToastProvider } from 'react-toast-notifications';

export default function Home() {
    const [session, loading] = useSession();

    return (
        <div className="bg-black w-full text-white">
            <NextSeo
                title="EloLeague | Log games and track player ratings for your casual league or club"
                description="EloLeague is the easiest platform for tracking games and player ratings for your league, club, or house."
            />
            <div className="max-w-4xl mx-auto px-4 py-16">
                <div className="text-center">
                    <h1 className="text-6xl font-semibold el-font-display uppercase mb-4">Know who's actually better</h1>
                    <p className="text-xl">Elo rankings and game records for your league, club, or house</p>
                </div>
            </div>
        </div>
    )
}