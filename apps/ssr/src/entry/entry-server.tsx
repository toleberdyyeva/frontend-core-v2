import React from 'react'
import ReactDOMServer from 'react-dom/server'
import {App} from "../app/app";

export function render() {

    // const head = collectHead => helmet, style-components ...
    const html = ReactDOMServer.renderToString(
        <React.StrictMode>
            <App />
        </React.StrictMode>
    )
    return { html }
}