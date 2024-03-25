export type SymbolMap = Map<string, number | undefined>;

export type Simplification = {
    name: string,
    before: string,
    after: string
}

export type Equation = {
    left: math.MathNode,
    right: math.MathNode
};

export type Expression = {
    left: math.MathNode,
    right: undefined
}