import Link from "next/link";
import {ReactNode} from "react";
import { AiOutlineCopy } from "react-icons/ai";
import { ToastProvider, useToasts } from 'react-toast-notifications';

function ElCopyBase({text, className, size, success, error}: {
    text: string,
    className?: string,
    size?: number,
    success?: string, 
    error?: string
}) {
    const { addToast } = useToasts();

    function copy () {
        var textArea = document.createElement("textarea");
        textArea.value = text;
        
        // Avoid scrolling to bottom
        textArea.style.top = "0";
        textArea.style.left = "0";
        textArea.style.position = "fixed";

        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();

        try {
            var successful = document.execCommand('copy');
            addToast(success || 'Copied!', { appearance: 'success', autoDismiss: true });
        } catch (err) {
            addToast(error || 'Error copying text', { appearance: 'error', autoDismiss: true });
        }

        document.body.removeChild(textArea);
    }
    
    return (
        <ToastProvider>
            <button onClick={copy} className={className + " focus:outline-none"}>
                <AiOutlineCopy  size={size || 25}/>
            </button>
        </ToastProvider>
    )
}

 export default function ElCopy({text, className, size, success, error}: {
    text: string,
    className?: string,
    size?: number,
    success?: string, 
    error?: string
}) {
    return (
        <ToastProvider>
            <ElCopyBase text={text} className={className} size={size} success={success} error={error}/>
        </ToastProvider>
    );
};