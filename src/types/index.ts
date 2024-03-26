export type SymbolMap = Map<string, { value: number | undefined, given: boolean }>;
export type KnownMap = Map<string, { value: number, given: boolean }>;

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