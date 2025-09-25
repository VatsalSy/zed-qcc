; Highlight Basilisk-specific constructs on top of the C grammar
((identifier) @function.basilisk
  (#match? @function.basilisk "^(event|foreach|foreach_face|foreach_dimension)$"))

((field_identifier) @variable.other.member
  (#match? @variable.other.member "^(x|y|z)$"))
