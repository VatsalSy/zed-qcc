(function_definition
  declarator: (function_declarator
    declarator: (identifier) @name)
  (#set! kind "function"))

(struct_specifier
  name: (type_identifier) @name
  (#set! kind "struct"))
