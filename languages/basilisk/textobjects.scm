(function_definition
  declarator: (function_declarator
    declarator: (identifier) @function.name)
  body: (compound_statement) @function.inside) @function.around
