import {ReactNode} from "react";

export default function ElTab({selected, onClick, children}: {
    selected: boolean,
    onClick: () => any,
    children: ReactNode
}) {
    return (
        <button
            className={"w-full px-4 py-2 text-center " + (selected ? "border-b-2 border-black" : "opacity-50")}
            onClick={onClick}
        >
            {children}
        </button>
    )
}