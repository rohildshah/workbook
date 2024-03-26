import { useEffect, useState } from 'react'
import { addStyles } from 'react-mathquill'
import SymbolTable from './components/SymbolTable';
import Statements from './components/Statements';
import { SymbolMap } from './types';
import { Box } from '@mui/material';

function App() {
    const [symbolMap, setSymbolMap] = useState<SymbolMap>(new Map());

    useEffect(() => {
        addStyles();
    }, []);

    const setSymbol = (symbol: string, value: number | undefined, given: boolean) => {
        setSymbolMap((prevSymbols) => new Map(prevSymbols).set(symbol, { value, given }));
    }

    const changeSymbols = (symbols: Set<string>) => {
        const newSymbolMap: SymbolMap = new Map();

        symbols.forEach((symbol) => {
            newSymbolMap.set(symbol, symbolMap.get(symbol) ?? { value: undefined, given: false });
        })

        setSymbolMap(newSymbolMap);
    }

    return (
        <Box className="flex flex-row place-content-between p-10">
            <Statements symbolMap={symbolMap} setSymbol={setSymbol} changeSymbols={changeSymbols} />
            <SymbolTable symbolMap={symbolMap} setSymbol={setSymbol} />
        </Box>
    )
}

export default App