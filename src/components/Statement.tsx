import React, { useEffect, useState } from 'react';
import { EditableMathField, StaticMathField } from 'react-mathquill';
import { parseTex } from 'tex-math-parser'
import math from 'tex-math-parser/dist/customMath';
import WarningIcon from '@mui/icons-material/Warning';
import { Autocomplete, Box, Input, Tooltip } from '@mui/material';
import { simplifyExpression, solveEquation } from 'mathsteps';
import { SymbolMap, Simplification, Expression, Equation } from '../types';
import { isOperatorNode, isSymbolNode } from 'mathjs';

interface MathFieldProps {
    symbolMap: SymbolMap;
    setSymbol: (symbol: string, value: string) => void;
    changeSymbols: (symbols: Set<string>) => void;
}

const Statement: React.FC<MathFieldProps> = (props) => {
    const { symbolMap, setSymbol, changeSymbols } = props;
    
    const [latex, setLatex] = useState<string>('');
    const [node, setNode] = useState<Expression | Equation | undefined>(undefined);
    const [symbols, setSymbols] = useState<Set<string>>(new Set());
    const [warning, setWarning] = useState<string>('');
    const [simplifications, setSimplifications] = useState<Simplification[]>([]);

    const toLatex = (tree: math.MathNode) => {
        return tree.toTex()
            .replace(/~/g, '')
            .replace(/\\mathrm\{(\w+)\}/g, '$1');
    }

    const toString = (tree: math.MathNode) => {
        return tree.toString({parenthesis: 'all', implicit: 'show'});
    }

    // https://github.com/google/mathsteps/blob/master/lib/solveEquation/index.js
    const isEquation = (latex: string) => {
        // const comparators = ['<=', '>=', '=', '<', '>'];
        const comparators = ['='];

        for (let i = 0; i < comparators.length; i++) {
            const comparator = comparators[i];

            const sides = latex.split(comparator);
            if (sides.length !== 2) continue;

            return comparator;
        }

        return ''
    }

    const splitEquation = (latex: string) => {
        const comparator = isEquation(latex);
        if (!comparator) return { left: '', right: '' };

        const sides = latex.split(comparator);
        return { left: sides[0], right: sides[1] };
    }

    const parseLatex = (latex: string) => {
        try {
            const parsedTree = parseTex(String.raw`${latex}`);

            const cleanedTree = parsedTree.transform((node, _path, _parent) => {
                if (isOperatorNode(node) && node.op === String.raw`\cdot`) node.op = '*';
                if (isOperatorNode(node) && node.op === String.raw`\frac`) node.op = '/';
    
                return node;
            });
    
            return { tree: cleanedTree, warning: '' };
        } catch (error) {
            // https://kentcdodds.com/blog/get-a-catch-block-error-message-with-typescript
            let message = 'Unknown Error';
            if (error instanceof Error) message = error.message;
            
            return { tree: undefined, warning: 'Failed to parse LaTeX: ' + message };
        }
    }

    const expressionSimplifications = (tree: math.MathNode) => {
        const newSimplifications: { name: string, before: string, after: string }[] = [];

        // Use MathJS simplification rules
        for (let i = 0; i < math.simplify.rules.length; i++) {
            const rule = math.simplify.rules[i];

            let newTree;
            try {
                newTree = math.simplify(tree, [rule]);
            } catch (error) {
                continue;
            }

            if (newTree.toString() === tree.toString()) continue;

            const name = typeof(rule) === 'function' 
                ? rule.name 
                : rule.s ? rule.s : rule.l + " -> " + rule.r;

            newSimplifications.push({
                name,
                before: toLatex(tree),
                after: toLatex(newTree)
            });
        }

        // Use mathsteps simplification rules
        const steps = simplifyExpression(toString(tree));
        if (steps.length !== 0) {
            // Add the first step
            newSimplifications.push({
                name: 'MathSteps',
                before: toLatex(tree),
                after: toLatex(steps[0].newNode)
            });

            // Add the first substep if it exists
            if (steps[0].substeps.length !== 0) {
                newSimplifications.push({
                    name: 'MathSteps',
                    before: toLatex(tree),
                    after: toLatex(steps[0].substeps[0].newNode)
                });
            }
        }

        return newSimplifications;
    }

    const equationSimplifications = (leftTree: math.MathNode, rightTree: math.MathNode) => {
        const newSimplifications: { name: string, before: string, after: string }[] = [];

        // Compute left side changes and add unchanged right side
        const leftSimplifications = expressionSimplifications(leftTree);
        leftSimplifications.forEach((simplification) => {
            simplification.before += '=' + toLatex(rightTree);
            simplification.after += '=' + toLatex(rightTree);
        });

        // Compute right side changes and add unchanged left side
        const rightSimplifications = expressionSimplifications(rightTree);
        rightSimplifications.forEach((simplification) => {
            simplification.before = toLatex(leftTree) + '=' + simplification.before;
            simplification.after = toLatex(leftTree) + '=' + simplification.after;
        });

        // Combine left and right side changes
        newSimplifications.push(...leftSimplifications, ...rightSimplifications);

        // Use mathsteps equation simplification rules
        const steps = solveEquation(toString(leftTree) + '=' + toString(rightTree));
        if (steps.length !== 0) {
            newSimplifications.push({
                name: 'MathSteps cross',
                before: toLatex(leftTree) + '=' + toLatex(rightTree),
                after: toLatex(steps[0].newEquation.leftNode) + '=' + toLatex(steps[0].newEquation.rightNode)
            })
        }

        return newSimplifications;
    }

    const findSymbols = (tree: math.MathNode) => {
        const newSymbols: Set<string> = new Set();

        tree.traverse(function (node, _path, _parent) {
            if (isSymbolNode(node)) newSymbols.add(node.name);
        })

        return newSymbols
    }

    const evaluateExpression = (node: Expression, knowns: { [key: string]: number }) => {
        if (symbols.size !== Object.keys(knowns).length) return;
        
        const expression = node.left;

        console.log(expression.evaluate(knowns));

        // const steps = solveEquation('7x + 7y = 35');
        // console.log(steps[4].newEquation.leftNode.toString() + '=' + steps[4].newEquation.rightNode.toString());
    }

    const evaluateEquation = (node: Equation, knowns: { [key: string]: number }) => {
        if (symbols.size !== Object.keys(knowns).length + 1) return;
        let { left, right } = node;

        left = left.transform(function (node, _path, _parent) {
            if (isSymbolNode(node) && knowns[node.name] !== undefined) {
                // console.log(node.name, knowns[node.name])
                // console.log(new math.ConstantNode(knowns[node.name]))
                return new math.ConstantNode(knowns[node.name]);
            } else {
                return node;
            }
        });

        right = right.transform((node, _path, _parent) => {
            if (isSymbolNode(node) && knowns[node.name] !== undefined) {
                return new math.ConstantNode(knowns[node.name]);
            }
            return node;
        });

        const steps = solveEquation(toString(left) + '=' + toString(right));
        // console.log(steps[steps.length - 1].newEquation.leftNode.toString() + '=' + steps[steps.length - 1].newEquation.rightNode.toString());

        const lastStep = steps.length > 0 ? steps[steps.length - 1].newEquation : { leftNode: left, rightNode: right };
        const symbol = lastStep.leftNode.toString();
        const value = lastStep.rightNode.toString();

        setSymbol(symbol, value);
    }

    useEffect(() => {
        if (!node) return;

        const knowns: { [key: string]: number } = {};

        symbols.forEach((symbol) => {
            const value = symbolMap.get(symbol);
            if (value !== undefined) knowns[symbol] = value;
        });

        if (node.right) {
            evaluateEquation(node, knowns);
        } else {
            evaluateExpression(node, knowns);
        }
    }, [symbolMap]);

    useEffect(() => {
        if (!node) {
            setSimplifications([]);
            setSymbols(new Set<string>());
            return;
        }

        const { left: leftTree, right: rightTree } = node;
        if (rightTree) { // Equation
            setSimplifications(equationSimplifications(leftTree, rightTree));
            setSymbols(new Set([...findSymbols(leftTree), ...findSymbols(rightTree)]));
        } else { // Expression
            setSimplifications(expressionSimplifications(leftTree));
            setSymbols(findSymbols(leftTree));
        }
    }, [node])

    useEffect(() => {
        changeSymbols(symbols);
    }, [symbols]);

    useEffect(() => {
        if (isEquation(latex)) {
            const { left, right } = splitEquation(latex);

            const { tree: leftTree, warning: leftWarning } = parseLatex(left);
            const { tree: rightTree, warning: rightWarning } = parseLatex(right);

            setWarning(leftWarning || rightWarning);
            setNode((!leftTree || !rightTree) ? undefined : { left: leftTree, right: rightTree });
        } else {
            const { tree, warning } = parseLatex(latex);

            setWarning(warning);
            setNode(!tree ? undefined : { left: tree, right: undefined });
        }
    }, [latex]);

    return (
        <>
            <div className="flex flex-col mb-5">
                <div className="flex justify-center items-center">
                    {warning && 
                        <Tooltip title={warning}>
                            <WarningIcon color="warning"/>    
                        </Tooltip>
                    }
                    <EditableMathField
                        latex={latex}
                        onChange={(mathField) => { setLatex(mathField.latex()); }}
                        // onMouseOver={(e) => {
                        //     const target = e.nativeEvent.target as HTMLElement;
                        //     const relatedTarget = e.nativeEvent.relatedTarget as HTMLElement;
                        //     if (!target && !relatedTarget) return;
                        //     if (target.classList.contains('mq-root-block')
                        //         || target.classList.contains('mq-textarea')
                        //         || target.classList.contains('mq-editable-field')) return;

                        //     target.style.backgroundColor = 'red';
                        //     relatedTarget.style.backgroundColor = 'transparent';
                        //     console.log(target);
                        // }}
                    />
                    {/* <div className="flex flex-col">
                        <p>latex: {latex}</p>
                    </div> */}
                </div>
                <Autocomplete
                    // open
                    multiple
                    value={[]}
                    onClose={() => {}}
                    onChange={(_event, value, reason) => {
                        if (reason !== 'selectOption') return;
                        setLatex(value[0].after);
                    }}
                    renderTags={() => null}
                    noOptionsText="No simplifications found"
                    renderOption={(props, option, { selected }) => (
                        <li {...props}>
                            <Box> {option.name} </Box>
                            <Box>:&nbsp;</Box>
                            <StaticMathField>{option.before}</StaticMathField>
                            <Box>&nbsp;-&#62;&nbsp;</Box>
                            <StaticMathField>{option.after}</StaticMathField>
                        </li>
                    )}
                    options={simplifications}
                    getOptionLabel={(option) => option.name + ': ' + option.before + ' -> ' + option.after}
                    renderInput={(params) => (
                        <Input
                            ref={params.InputProps.ref}
                            inputProps={params.inputProps}
                            placeholder="Search"
                            sx={{ width: 600 }}
                        />
                    )}
                />
            </div>
        </>
    );
};

export default Statement;