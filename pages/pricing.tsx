import {signIn, useSession} from "next-auth/client";
import ElH1 from "../components/ElH1";
import ElH2 from "../components/ElH2";
import ElButton from "../components/ElButton";
import React, {useState} from "react";
import axios from "axios";
import {loadStripe} from "@stripe/stripe-js/pure";
import ElNextSeo from "../components/ElNextSeo";
import ElInfoBox from "../components/ElInfoBox";
import {BiInfoCircle} from "react-icons/bi";

export default function Pricing() {
    const [session, loading] = useSession();
    const [individualLoading, setIndividualLoading] = useState<boolean>(false);
    const [clubLoading, setClubLoading] = useState<boolean>(false);

    const priceContainerClass = "mx-4 md:w-1/3 p-4 shadow-md";
    const priceClass = "text-xl mt-2 font-bold mb-4";
    const priceDescriptClass = "list-disc pl-6 text-xl";
    const priceButtonClass = "mt-8";

    async function createCheckoutSession(tier: "individual" | "club") {
        if (tier === "individual") setIndividualLoading(true); else setClubLoading(true);

        const stripe = await loadStripe(process.env.NEXT_PUBLIC_STRIPE_PK);

        // priceIds from Stripe Products
        const priceId = tier === "individual" ? process.env.NEXT_PUBLIC_INDIVIDUAL_PRICE_ID : process.env.NEXT_PUBLIC_CLUB_PRICE_ID;

        axios.post("/api/billing/create-checkout-session", {
            priceId: priceId,
        }).then(res => {
            console.log(res.data.sessionId);
            stripe.redirectToCheckout({sessionId: res.data.sessionId});
        }).catch(e => {
            console.log(e);
            setIndividualLoading(false);
            setClubLoading(false);
        });
    }

    return (
        <div className="max-w-4xl mx-auto px-4 py-4">
            <ElNextSeo title="Pricing"/>
            <ElH1>{session ? "Upgrade" : "Pricing"}</ElH1>
            {session && (
                <ElInfoBox className="my-4">
                    <div className="flex items-center">
                        <BiInfoCircle className="flex-shrink-0"/>
                        <p className="text-lg ml-4">
                            You are currently on a <b>{session.tier}</b> plan.
                        </p>
                    </div>
                </ElInfoBox>
            )}
            <hr className="my-6"/>
            <div className="md:flex -mx-4">
                <div className={priceContainerClass}>
                    <ElH2>Free</ElH2>
                    <p className={priceClass}>$0/month</p>
                    <ul className={priceDescriptClass}>
                        <li>One league</li>
                        <li>Unlimited players</li>
                        <li>Unlimited games</li>
                    </ul>
                    <ElButton className={priceButtonClass} disabled={!!session} onClick={() => signIn("google")}>Get started</ElButton>
                </div>
                <div className={priceContainerClass}>
                    <ElH2>Individual</ElH2>
                    <p className={priceClass}>$10/month</p>
                    <ul className={priceDescriptClass}>
                        <li>Unlimited leagues</li>
                    </ul>
                    <ElButton
                        className={priceButtonClass}
                        onClick={() => createCheckoutSession("individual")}
                        isLoading={individualLoading}
                        disabled={session && session.tier !== "free"}
                    >
                        {((session && session.trialUsed) ? "Upgrade" : "Start free trial")}
                    </ElButton>
                </div>
                <div className={priceContainerClass}>
                    <ElH2>Club</ElH2>
                    <p className={priceClass}>$30/month</p>
                    <ul className={priceDescriptClass}>
                        <li>Unlimited leagues</li>
                        <li>Player profiles</li>
                        <li>Player head to heads</li>
                    </ul>
                    <ElButton
                        className={priceButtonClass}
                        onClick={() => createCheckoutSession("club")}
                        isLoading={clubLoading}
                        disabled={session && session.tier === "club"}
                    >
                        {((session && session.trialUsed) ? "Upgrade" : "Start free trial")}
                    </ElButton>
                </div>
            </div>
        </div>
    )
}