import React, { useEffect, useState } from 'react';
import Statement from './Statement';
import { Equation, SymbolMap } from '../types';
import { Box } from '@mui/material';
import AddCircleIcon from '@mui/icons-material/AddCircle';
import useMousePosition from '../hooks/useMousePosition';

type StatementsProps = {
    symbolMap: SymbolMap;
    setSymbol: (symbol: string, value: number | undefined, given: boolean) => void;
    changeSymbols: (symbols: Set<string>) => void;
};

const Statements: React.FC<StatementsProps> = (props) => {
    const DEFAULT_NUM_STATEMENTS = 2;
    const { symbolMap, setSymbol, changeSymbols } = props;

    const mousePosition = useMousePosition();
    const [numStatements, setNumStatements] = useState<number>(DEFAULT_NUM_STATEMENTS);
    const [symbolMaps, setSymbolMaps] = useState<Map<number, Set<string>>>(new Map());
    const [substitution, setSubstitution] = useState<Equation>();

    useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') setSubstitution(undefined);
        }

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, []);

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
        <Box className="flex flex-col items-center">
            {Array.from({ length: numStatements }).map((_, i) => (
                <Statement
                    key={i}
                    index={i}
                    symbolMap={symbolMap}
                    changeSymbols={(symbolMap: Set<string>) => {
                        setSymbolMaps((prevSymbolMaps: Map<number, Set<string>>) => {
                            return new Map(prevSymbolMaps).set(i, symbolMap);
                        })
                    }}
                    setSymbol={setSymbol}
                    substitution={substitution}
                    setSubstitution={(substitution: Equation | undefined) => setSubstitution(substitution)}
                />
            ))}
            <AddCircleIcon
                className="cursor-pointer hover:text-blue-500"
                color="action"
                onClick={() => setNumStatements(numStatements + 1)} 
            />
            <Box
                position="absolute"
                className="z-[9999] pointer-events-none"
                left={mousePosition.x - 10}
                top={mousePosition.y - 20}
            >
                    {substitution?.left.name}
            </Box>
        </Box>
    );
};

export default Statements;