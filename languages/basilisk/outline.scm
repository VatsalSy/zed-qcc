(function_definition
  declarator: (function_declarator
    declarator: (identifier) @name)
  (#set! kind "function"))

(function_definition
  declarator: (function_declarator
    declarator: (pointer_declarator
      declarator: (identifier) @name))
  (#set! kind "function"))

(function_definition
  declarator: (function_declarator
    declarator: (parenthesized_declarator
      declarator: (identifier) @name))
  (#set! kind "function"))

(struct_specifier
  name: (type_identifier) @name
  (#set! kind "struct"))

(union_specifier
  name: (type_identifier) @name
  (#set! kind "union"))

(enum_specifier
  name: (type_identifier) @name
  (#set! kind "enum"))
