import { useEffect, useState } from 'react'
import './App.css'
import { addStyles } from 'react-mathquill'
import SymbolTable from './components/SymbolTable';
import Statements from './components/Statements';
import { SymbolMap } from './types';

function App() {
    const [symbolMap, setSymbolMap] = useState<SymbolMap>(new Map());

    useEffect(() => {
        addStyles();
    }, []);

    const setSymbol = (symbol: string, value: string) => {
        const parsedValue = parseFloat(value);
        const safeValue = isNaN(parsedValue) ? undefined : parsedValue;

        setSymbolMap((prevSymbols) => new Map(prevSymbols).set(symbol, safeValue));
    }

    const changeSymbols = (symbols: Set<string>) => {
        const newSymbolMap: SymbolMap = new Map();

        symbols.forEach((symbol) => {
            newSymbolMap.set(symbol, symbolMap.get(symbol));
        })

        setSymbolMap(newSymbolMap);
    }

    return (
        <>
            <div className="flex flex-col justify-center items-center h-screen">
                <SymbolTable symbolMap={symbolMap} setSymbol={setSymbol} />
                <Statements symbolMap={symbolMap} setSymbol={setSymbol} changeSymbols={changeSymbols} />
            </div>
        </>
    )
}

export default App