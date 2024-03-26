import { Checkbox, Table, TableBody, TableCell, TableHead, TableRow, TextField } from '@mui/material';
import React from 'react';
import { SymbolMap } from '../types';

type SymbolTableProps = {
    symbolMap: SymbolMap;
    setSymbol: (symbol: string, value: number | undefined, given: boolean) => void;
};

const SymbolTable: React.FC<SymbolTableProps> = (props) => {
    const { symbolMap, setSymbol } = props;

    return (
        <Table className="max-w-64" size="small" padding="none">
            <TableHead>
                <TableRow>
                    <TableCell align="center" className="w-1/4">Variable</TableCell>
                    <TableCell align="center" className="w-1/2">Value</TableCell>
                    <TableCell align="center" className="w-1/4">Given</TableCell>
                </TableRow>
            </TableHead>
            <TableBody>
                {Array.from(symbolMap).map(([symbol, { value, given }]) => (
                    <TableRow key={symbol}>
                        <TableCell align="center">{symbol}</TableCell>
                        <TableCell align="center">
                            <TextField
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
                        </TableCell>
                        <TableCell align="center">
                            <Checkbox 
                                checked={given} 
                                onChange={(e) => setSymbol(symbol, value, e.target.checked)}
                            />
                        </TableCell>
                    </TableRow>
                ))}
            </TableBody>
        </Table>
    );
};

export default SymbolTable;