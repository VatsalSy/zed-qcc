(function_definition
  declarator: (function_declarator
    declarator: (identifier) @function.name)
  body: (compound_statement) @function.inside) @function.around

; Pointer declarators: return_type (*function_name)(args)
(function_definition
  declarator: (function_declarator
    declarator: (pointer_declarator
      declarator: (identifier) @function.name))
  body: (compound_statement) @function.inside) @function.around

; Parenthesized declarators: return_type (function_name)(args)
(function_definition
  declarator: (function_declarator
    declarator: (parenthesized_declarator
      declarator: (identifier) @function.name))
  body: (compound_statement) @function.inside) @function.around
