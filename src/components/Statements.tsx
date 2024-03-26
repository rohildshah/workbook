import React, { useEffect, useState } from 'react';
import Statement from './Statement';
import { SymbolMap } from '../types';
import { Box } from '@mui/material';

type StatementsProps = {
    symbolMap: SymbolMap;
    setSymbol: (symbol: string, value: number | undefined, given: boolean) => void;
    changeSymbols: (symbols: Set<string>) => void;
};

const Statements: React.FC<StatementsProps> = (props) => {
    const NUM_STATEMENTS = 2;
    const { symbolMap, setSymbol, changeSymbols } = props;

    const [symbolMaps, setSymbolMaps] = useState<Map<number, Set<string>>>(new Map());

    useEffect(() => {
        const symbols: Set<string> = new Set();

        symbolMaps.forEach((statementSymbols: Set<string>) => {
            statementSymbols.forEach((_, symbol) => {
                symbols.add(symbol);
            });
        });

        changeSymbols(symbols);
    }, [symbolMaps]);

    return (
        <Box className="flex flex-col">
            {Array.from({ length: NUM_STATEMENTS }).map((_, i) => (
                <Statement
                    key={i}
                    symbolMap={symbolMap}
                    changeSymbols={(symbolMap: Set<string>) => {
                        setSymbolMaps((prevSymbolMaps: Map<number, Set<string>>) => {
                            return new Map(prevSymbolMaps).set(i, symbolMap);
                        })
                    }}
                    setSymbol={setSymbol}
                />
            ))}
        </Box>
    );
};

export default Statements;