import { Box, Checkbox, TextField } from '@mui/material';
import React from 'react';
import { SymbolMap } from '../types';

type SymbolTableProps = {
    symbolMap: SymbolMap;
    setSymbol: (symbol: string, value: number | undefined, given: boolean) => void;
};

const SymbolTable: React.FC<SymbolTableProps> = (props) => {
    const { symbolMap, setSymbol } = props;

    return (
        Array.from(symbolMap).map(([symbol, { value, given }]) => (
            <Box key={symbol} className="flex flex-row items-end">
                <Box className="mr-4">{symbol}</Box>
                <TextField
                    label={`Value for ${symbol}`}
                    type="number"
                    variant="standard"
                    margin="none"
                    value={value ?? ''}
                    onChange={(e) => {
                        const parsedValue = parseFloat(e.target.value);
                        const safeValue = isNaN(parsedValue) ? undefined : parsedValue;

                        // If the value is erased, then it can't be given (reconsider this later if necessary)
                        const given = !isNaN(parsedValue);

                        setSymbol(symbol, safeValue, given);
                    }}
                />
                <Checkbox 
                    checked={given} 
                    onChange={(e) => setSymbol(symbol, value, e.target.checked)}
                />
                <Box>Given</Box>
            </Box>
        ))
    );
};

export default SymbolTable;