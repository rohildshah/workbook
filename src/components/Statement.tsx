import React, { useEffect, useState } from 'react';
import { EditableMathField, StaticMathField } from 'react-mathquill';
import { parseTex } from 'tex-math-parser'
import math from 'tex-math-parser/dist/customMath';
import WarningIcon from '@mui/icons-material/Warning';
import { Autocomplete, Box, ClickAwayListener, Input, Popper, Tooltip } from '@mui/material';
import { simplifyExpression, solveEquation } from 'mathsteps';
import { SymbolMap, Simplification, Expression, Equation, KnownMap } from '../types';
import MoveDownIcon from '@mui/icons-material/MoveDown';

interface StatementProps {
    index: number;
    symbolMap: SymbolMap;
    setSymbol: (symbol: string, value: number | undefined, given: boolean) => void;
    changeSymbols: (symbols: Set<string>) => void;
    substitution: Equation | undefined;
    setSubstitution: (substitution: Equation | undefined) => void;
}

const Statement: React.FC<StatementProps> = (props) => {
    const { index, symbolMap, setSymbol, changeSymbols, substitution, setSubstitution } = props;
    
    const [latex, setLatex] = useState<string>('');
    const [node, setNode] = useState<Expression | Equation | undefined>(undefined);
    const [symbols, setSymbols] = useState<Set<string>>(new Set());
    const [warning, setWarning] = useState<string>('');
    const [simplifications, setSimplifications] = useState<Simplification[]>([]);
    const [searchAnchor, setSearchAnchor] = useState<null | HTMLElement>(null);

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

    const isSubstitutable = () => {
        // Check if equation
        if (!node || !node.right) return false;

        // Check if left side is a symbol
        if (!math.isSymbolNode(node.left)) return false;

        return true;
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

            const cleanedTree = parsedTree.transform((node) => {
                if (math.isOperatorNode(node) && node.op === String.raw`\cdot`) node.op = '*';
                if (math.isOperatorNode(node) && node.op === String.raw`\frac`) node.op = '/';
    
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

        tree.traverse(function (node) {
            if (math.isSymbolNode(node)) newSymbols.add(node.name);
        })

        return newSymbols
    }

    const replaceSymbols = (node: Equation, knowns: KnownMap) => {
        let { left, right } = node;

        left = left.transform(function (node) {
            if (!math.isSymbolNode(node)) return node;

            const value = knowns.get(node.name);
            if (value == undefined) return node;

            return new math.ConstantNode(Number(value.value));
        });

        right = right.transform((node) => {
            if (!math.isSymbolNode(node)) return node;

            const value = knowns.get(node.name);
            if (value == undefined) return node;

            return new math.ConstantNode(Number(value.value));
        });

        return { left, right }
    }

    const evaluateExpression = (node: Expression, symbols: Set<string>, knowns: KnownMap) => {
        if (symbols.size !== knowns.size) return;
        
        const expression = node.left;
        const values = Object.fromEntries(Array.from(knowns, ([key, value]) => [key, value.value]));

        console.log(expression.evaluate(values));
    }

    const evaluateEquation = (node: Equation, symbols: Set<string>, knowns: KnownMap) => {
        const givens = new Map([...knowns].filter(([, value]) => value.given));

        const evaluateAndSetSymbol = (knowns: KnownMap) => {
            const { left, right } = replaceSymbols(node, knowns);
            const steps = solveEquation(toString(left) + '=' + toString(right));

            const lastStep = steps.length > 0 ? steps[steps.length - 1].newEquation : { leftNode: left, rightNode: right };
            const symbol = lastStep.leftNode.toString();
            const value = math.evaluate(toString(lastStep.rightNode.toString()));

            if (symbolMap.get(symbol)?.given) return;
            console.log(math.evaluate(toString(lastStep.rightNode)))
            setSymbol(symbol, value, false);
        }

        if (knowns.size == symbols.size) {
            const { left, right } = replaceSymbols(node, knowns);
            const steps = solveEquation(toString(left) + '=' + toString(right));
            const correct = steps.length === 0 || steps[steps.length - 1].changeType !== 'STATEMENT_IS_FALSE';

            if (!correct && givens.size == symbols.size - 1) { // False but try to fix
                evaluateAndSetSymbol(givens);
            } else if (!correct) { // False but can't fix
                setWarning('Equation is false');
            } else {
                setWarning('');
            }
        } else if (knowns.size == symbols.size - 1) {
            evaluateAndSetSymbol(knowns);
        } else {
            // 
        }
    }

    const evaluate = (symbols: Set<string>) => {
        if (!node) return;

        const knowns: KnownMap = new Map();
            
        symbols.forEach((symbol) => {
            const { value, given } = symbolMap.get(symbol) ?? { value: undefined, given: false };
            if (value !== undefined) knowns.set(symbol, { value, given });
        });

        if (node.right) {
            evaluateEquation(node, symbols, knowns);
        } else {
            evaluateExpression(node, symbols, knowns);
        }
    }

    useEffect(() => {
        setSubstitution(undefined);

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

    useEffect(() => {
        if (!node) {
            setSimplifications([]);
            setSymbols(new Set<string>());
            return;
        }

        const { left: leftTree, right: rightTree } = node;
        if (rightTree) { // Equation
            setSimplifications(equationSimplifications(leftTree, rightTree));

            const symbols = new Set([...findSymbols(leftTree), ...findSymbols(rightTree)])
            setSymbols(symbols);
            evaluate(symbols);
        } else { // Expression
            setSimplifications(expressionSimplifications(leftTree));

            const symbols = findSymbols(leftTree);
            setSymbols(symbols);
            evaluate(symbols);
        }
    }, [node])

    useEffect(() => {
        changeSymbols(symbols);
    }, [symbols]);

    useEffect(() => {
        evaluate(symbols);
    }, [symbolMap]);

    // useEffect(() => {
    //     if (!substitution || !node) return;

    //     const transform = (node: math.MathNode) => {
    //         const { left: symbol, right: value } = substitution;
    //         return node.transform(n => n.equals(symbol) ? value : n);
    //     }

    //     const left = transform(node.left);
    //     const right = node.right && transform(node.right);

    //     const latex = right ? toLatex(left) + '=' + toLatex(right) : toLatex(left);
    //     setLatex(latex);
    // }, [substitution]);

    return (
        <Box className="flex flex-col mb-5">
            <ClickAwayListener onClickAway={() => setSearchAnchor(null)}>
                <Box className="flex justify-center items-center w-52">
                    <Box className="w-10">
                        {warning && 
                            <Tooltip title={warning}>
                                <WarningIcon 
                                    color={warning.indexOf("Equation is false") ? "warning" : "error"}
                                    className="mr-2"
                                />
                            </Tooltip>
                        }
                        {!warning && isSubstitutable() &&
                            <Tooltip title="Substitute">
                                <MoveDownIcon
                                    color="action"
                                    className="mr-2"
                                    onMouseDown={() => {
                                        // Check if equation
                                        if (!node || !node.right) return;
                        
                                        // Check if left side is a symbol
                                        if (!math.isSymbolNode(node.left)) return;
                        
                                        setSubstitution(node);
                                    }}
                                    onMouseUp={() => {
                                        if (!substitution || !node) return;
                        
                                        const transform = (node: math.MathNode) => {
                                            const { left: symbol, right: value } = substitution;
                                            return node.transform(n => n.equals(symbol) ? value : n);
                                        }
                        
                                        const left = transform(node.left);
                                        const right = node.right && transform(node.right);
                        
                                        const latex = right ? toLatex(left) + '=' + toLatex(right) : toLatex(left);
                                        setLatex(latex);
                                    }}
                                />
                            </Tooltip>
                        }
                    </Box>
                    <Box id={"popper-anchor-" + index} position="relative" left="190px" top="25px" />
                    <EditableMathField
                        latex={latex}
                        onChange={(mathField) => { setLatex(mathField.latex()); }}
                        className="w-full !border-gray-300 rounded p-2"
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
                        onClick={(e) => {
                            // setSearchAnchor(e.currentTarget);
                            setSearchAnchor(document.getElementById('popper-anchor-' + index));
                        }}
                    />
                    <Popper
                        open={Boolean(searchAnchor)}
                        anchorEl={searchAnchor}
                        // modifiers={[
                        //     {
                        //         name: 'offset',
                        //         options: {
                        //             offset: [105, 5],
                        //         }
                        //     }
                        // ]}
                    >
                        <Autocomplete
                            open
                            multiple
                            value={[]}
                            onClose={() => {}}
                            onChange={(_event, value, reason) => {
                                if (reason !== 'selectOption') return;
                                setLatex(value[0].after);
                            }}
                            renderTags={() => null}
                            noOptionsText="No simplifications found"
                            renderOption={(props, option) => (
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
                                    className="w-96 bg-white"
                                />
                            )}
                        />
                    </Popper>
                </Box>
            </ClickAwayListener>
        </Box>
    );
};

export default Statement;