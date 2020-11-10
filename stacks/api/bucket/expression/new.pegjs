{  
  function merge(lhs, rhs)  { 
    return rhs.reduce( (lhs,rhs) => ({...rhs, lhs}), lhs) 
  }  
}

//Expr = condition:ConditionalOr "?" t:ConditionalOr ":" f:Expr { return {} }  / ConditionalOr
Expr = ConditionalOr
ConditionalOr  = "||"? lhs:ConditionalAnd rhs:ConditionalOr? {
	return {lhs, rhs}
}
ConditionalAnd = "&&"? Relation
Relation       = Addition Relop*
Relop          = "<" / "<=" / ">=" / ">" / "==" / "!=" / "in" {return text()}
Addition       = ("+" / "-")? Multiplication Addition?
Multiplication = ("*" / "/" / "%")? Unary Multiplication?
Unary          = Member
               / "!" "!"* Member
               / "-" "-"* Member
               ;
Member         = Primary
               / "." IDENT ("(" ExprList? ")")? Member
               / "[" Expr "]" Member
               / "{" FieldInits? "}" Member

Primary        = "."? IDENT ("(" ExprList? ")")? 
			   / "(" Expr ")"
               / "[" ExprList? "]"
               / "{" MapInits? "}"
               / LITERAL

ExprList       = Expr ("," Expr)*
FieldInits     = IDENT ":" Expr ("," IDENT ":" Expr)*
MapInits       = Expr ":" Expr ("," Expr ":" Expr)*



// LEXIS
IDENT = !RESERVED [_a-zA-Z][_a-zA-Z0-9]*  { 
	return {kind: "identifier", name: text()} 
}


LITERAL = value:FLOAT_LIT { return { kind: "literal", type: "double", value } }
        / value:UINT_LIT { return { kind: "literal", type: "uint", value } }
        / value:INT_LIT { return { kind: "literal", type: "int", value } }
        / value:BYTES_LIT { return { kind: "literal", type: "bytes", value } }
        / value:STRING_LIT { return { kind: "literal", type: "string", value } } 
        / value:BOOL_LIT { return { kind: "literal", type: "bool", value } } 
        / value:NULL_LIT { return { kind: "literal", type: "null", value } }

INT_LIT = "0x" HEXDIGIT+ { return parseInt(text(), 16) }
  / DIGIT+ { return parseInt(text(), 10) }
  
UINT_LIT = int:INT_LIT [uU] { return Math.abs(int) }

FLOAT_LIT = DIGIT* "." DIGIT+ EXPONENT? / DIGIT+ EXPONENT { 
	return parseFloat(text())
}

DIGIT = [0-9]

HEXDIGIT = [0-9abcdefABCDEF]

EXPONENT = [eE] [+-]? DIGIT+
  
STRING_LIT = raw:[rR]? chars:(
    '"""' chars:( !( '"""' ) (ESCAPE / .) )* '"""' { return chars.map( t => t[1] ) }
    / "'''" chars:( !( "'''" ) (ESCAPE / .) )* "'''" { return chars.map( t => t[1] ) }
    / '"' chars:( !( '"'  / NEWLINE ) (ESCAPE / .) )* '"'   { return chars.map( t => t[1] ) }
    / "'" chars:( !( "'"  / NEWLINE ) (ESCAPE / .) )* "'" { return chars.map( t => t[1] ) } 
  ) { return chars.map( c => (raw && c.rawVal) ? c.rawVal : c.toString()).join("") } 

BYTES_LIT = [bB] chars:STRING_LIT { 
	return Uint8Array.from(  chars.split("").map( c=>c.codePointAt(0) )  )
}

ESCAPE = "\\" eskey:$[bfnrt"'\\] {
      const strVal = ({
        'b': "\b",
        'f': "\f",
        'n': "\n",
        'r': "\r",
        't': "\t",
        '"': "\"",
        '\'': "\'",
        '\\': "\\"
      })[eskey]
      
	  const numVal = strVal.codePointAt(0)
      
      if(!eskey) throw "escape char error";
      return ({ 
          type: "escapeChar", 
          toString: () => strVal, 
          rawVal: text()
      })
    }
  / "\\" "u" hx:$(HEXDIGIT HEXDIGIT HEXDIGIT HEXDIGIT) { 
  		const numVal = parseInt(hx,16)
  		return ({ 
        	type: "escapeChar", 
            toString: () => String.fromCodePoint(numVal), 
            rawVal: text()
        }) 
     }
  / "\\" oct:$([0-3] [0-7] [0-7]) { 
  		const numVal = parseInt(oct,8)
  		return ({ 
        	type: "escapeChar", 
            toString: () => String.fromCodePoint(numVal), 
            rawVal: text()
        }) 
     }
     
NEWLINE        = [\r\n] / [\r] / [\n]
BOOL_LIT       = "true" / "false"
NULL_LIT       = "null"
RESERVED       = BOOL_LIT / NULL_LIT / "in"
                 / "as" / "break" / "const" / "continue" / "else"
                 / "for" / "function" / "if" / "import" / "let"
                 / "loop" / "package" / "namespace" / "return"
                 / "var" / "void" / "while"
WHITESPACE     = [\t\n\f\r ]*
COMMENT        = '//'
