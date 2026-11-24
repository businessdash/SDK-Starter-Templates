<?php

namespace App\Bd\Forms;

/** Recursive descent over the tokens, precedence lowest first. */
final class FormulaParser
{
    private int $pos = 0;

    /** @param  list<array{string, mixed}>  $tokens */
    public function __construct(private readonly array $tokens) {}

    public function parse(): array
    {
        $node = $this->or();
        if ($this->pos < count($this->tokens)) {
            throw new FormulaError('Unexpected trailing input.');
        }

        return $node;
    }

    private function peek(): ?array
    {
        return $this->tokens[$this->pos] ?? null;
    }

    private function next(): ?array
    {
        return $this->tokens[$this->pos++] ?? null;
    }

    private function eat(string $kind): array
    {
        $t = $this->next();
        if ($t === null || $t[0] !== $kind) {
            throw new FormulaError("Expected {$kind}.");
        }

        return $t;
    }

    private function isOp(string $op): bool
    {
        $t = $this->peek();

        return $t !== null && $t[0] === 'op' && $t[1] === $op;
    }

    private function isKind(string $kind): bool
    {
        return ($this->peek()[0] ?? null) === $kind;
    }

    private function isIdent(string $word): bool
    {
        $t = $this->peek();

        return $t !== null && $t[0] === 'ident' && strtoupper($t[1]) === $word;
    }

    private function or(): array
    {
        $left = $this->and();
        while ($this->isOp('||') || $this->isIdent('OR')) {
            $this->next();
            $left = ['binary', 'OR', $left, $this->and()];
        }

        return $left;
    }

    private function and(): array
    {
        $left = $this->not();
        while ($this->isOp('&&') || $this->isIdent('AND')) {
            $this->next();
            $left = ['binary', 'AND', $left, $this->not()];
        }

        return $left;
    }

    private function not(): array
    {
        if ($this->isOp('!') || $this->isIdent('NOT')) {
            $this->next();

            return ['unary', 'NOT', $this->not()];
        }

        return $this->comparison();
    }

    private function comparison(): array
    {
        $left = $this->concat();
        while (($t = $this->peek()) !== null && $t[0] === 'op' && in_array($t[1], ['=', '==', '<>', '!=', '<', '>', '<=', '>='], true)) {
            $this->next();
            $left = ['binary', $t[1], $left, $this->concat()];
        }

        return $left;
    }

    private function concat(): array
    {
        $left = $this->add();
        while ($this->isOp('&')) {
            $this->next();
            $left = ['binary', '&', $left, $this->add()];
        }

        return $left;
    }

    private function add(): array
    {
        $left = $this->mul();
        while ($this->isOp('+') || $this->isOp('-')) {
            $op = $this->next()[1];
            $left = ['binary', $op, $left, $this->mul()];
        }

        return $left;
    }

    private function mul(): array
    {
        $left = $this->unary();
        while ($this->isOp('*') || $this->isOp('/') || $this->isOp('%')) {
            $op = $this->next()[1];
            $left = ['binary', $op, $left, $this->unary()];
        }

        return $left;
    }

    private function unary(): array
    {
        if ($this->isOp('-') || $this->isOp('+')) {
            $op = $this->next()[1];

            return ['unary', $op, $this->unary()];
        }

        return $this->power();
    }

    private function power(): array
    {
        $base = $this->primary();
        if ($this->isOp('^')) {
            $this->next();

            return ['binary', '^', $base, $this->unary()];
        }

        return $base;
    }

    private function primary(): array
    {
        $node = $this->atom();
        while ($this->isKind('dot')) {
            $this->next();
            $key = $this->eat('ident')[1];
            $node = ['member', $node, $key];
        }

        return $node;
    }

    private function atom(): array
    {
        $t = $this->peek();
        if ($t === null) {
            throw new FormulaError('Unexpected end of formula.');
        }
        switch ($t[0]) {
            case 'num':
                $this->next();

                return ['num', $t[1]];
            case 'str':
                $this->next();

                return ['str', $t[1]];
            case 'lparen':
                $this->next();
                $inner = $this->or();
                $this->eat('rparen');

                return $inner;
            case 'ident':
                $this->next();
                $upper = strtoupper($t[1]);
                if ($upper === 'TRUE') {
                    return ['bool', true];
                }
                if ($upper === 'FALSE') {
                    return ['bool', false];
                }
                if ($this->isKind('lparen')) {
                    $this->next();
                    $args = [];
                    if (! $this->isKind('rparen')) {
                        $args[] = $this->or();
                        while ($this->isKind('comma')) {
                            $this->next();
                            $args[] = $this->or();
                        }
                    }
                    $this->eat('rparen');

                    return ['call', $upper, $args];
                }

                return ['var', $t[1]];
        }
        throw new FormulaError('Unexpected token.');
    }
}
