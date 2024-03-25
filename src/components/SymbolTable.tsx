import { Box, TextField } from '@mui/material';
import React from 'react';

type SymbolTableProps = {
    symbolMap: Map<string, number | undefined>;
    setSymbol: (symbol: string, value: string) => void;
};

const SymbolTable: React.FC<SymbolTableProps> = (props) => {
    const { symbolMap, setSymbol } = props;

    return (
        Array.from(symbolMap).map(([symbol, value]) => (
            <Box key={symbol} className="flex flex-row items-end">
                <Box className="mr-4">{symbol}</Box>
                <TextField
                    label={`Value for ${symbol}`}
                    type="number"
                    variant="standard"
                    margin="none"
                    value={value ?? ''}
                    onChange={(e) => setSymbol(symbol, e.target.value)}
                />
            </Box>
        ))
    );
};

export default SymbolTable;