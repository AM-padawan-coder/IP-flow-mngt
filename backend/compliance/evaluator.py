"""
Évaluateur d'expressions sûr — sous-ensemble de Python via le module ast.

Aucun appel à eval() : on parse l'expression et on ne visite qu'une liste
blanche de nœuds (comparaisons, booléens, appartenance, littéraux, variables).
Cela rend l'exécution des `violation-when` du catalogue OSCAL inoffensive même
si le catalogue provient d'une source tierce.

L'évaluateur est volontairement agnostique du domaine : il évalue une expression
contre un contexte (dict de variables). Le « sujet » peut donc être un flux, un
équipement, une configuration… ce qui permet de réutiliser le moteur pour
d'autres usages que la conformité des flux.
"""

import ast
import operator
from typing import Any, Mapping

_CMP_OPS = {
    ast.Eq: operator.eq,
    ast.NotEq: operator.ne,
    ast.Lt: operator.lt,
    ast.LtE: operator.le,
    ast.Gt: operator.gt,
    ast.GtE: operator.ge,
}


class ExpressionError(Exception):
    """Expression invalide ou nœud non autorisé."""


def evaluate_expression(expr: str, context: Mapping[str, Any]) -> bool:
    """Évalue `expr` contre `context` et renvoie un booléen.

    Lève ExpressionError si l'expression est mal formée, utilise une
    construction non autorisée, ou référence une variable absente du contexte.
    """
    try:
        tree = ast.parse(expr, mode="eval")
    except SyntaxError as exc:
        raise ExpressionError(f"syntaxe invalide : {exc.msg}") from exc
    return bool(_eval(tree.body, context))


def _eval(node: ast.AST, ctx: Mapping[str, Any]) -> Any:
    if isinstance(node, ast.BoolOp):
        values = [_eval(v, ctx) for v in node.values]
        if isinstance(node.op, ast.And):
            return all(values)
        if isinstance(node.op, ast.Or):
            return any(values)
        raise ExpressionError("opérateur booléen non supporté")

    if isinstance(node, ast.UnaryOp):
        if isinstance(node.op, ast.Not):
            return not _eval(node.operand, ctx)
        raise ExpressionError("opérateur unaire non supporté")

    if isinstance(node, ast.Compare):
        left = _eval(node.left, ctx)
        for op, comparator in zip(node.ops, node.comparators):
            right = _eval(comparator, ctx)
            if isinstance(op, ast.In):
                result = left in right
            elif isinstance(op, ast.NotIn):
                result = left not in right
            else:
                fn = _CMP_OPS.get(type(op))
                if fn is None:
                    raise ExpressionError("comparateur non supporté")
                result = fn(left, right)
            if not result:
                return False
            left = right
        return True

    if isinstance(node, ast.Name):
        if node.id in ctx:
            return ctx[node.id]
        raise ExpressionError(f"variable inconnue : {node.id}")

    if isinstance(node, ast.Constant):
        return node.value

    if isinstance(node, (ast.List, ast.Tuple)):
        return [_eval(elt, ctx) for elt in node.elts]

    raise ExpressionError(f"expression non autorisée : {type(node).__name__}")
