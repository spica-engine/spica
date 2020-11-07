// VOCABULARY
Expr           = ConditionalOr ("?" ConditionalOr ":" Expr)? ;
ConditionalOr  = "||"? ConditionalAnd ;
ConditionalAnd = "&&"? Relation ;
Relation       = Relop? Addition ;
Relop          = "<" / "<=" / ">=" / ">" / "==" / "!=" / "in" ;
Addition       = ("+" / "-") Multiplication ;
Multiplication = ("*" / "/" / "%")? Unary ;
Unary          = Member
               / "!" "!"* Member
               / "-" "-"* Member
               ;
Member         = Primary
               / "." IDENT ("(" ExprList? ")")?
               / "[" Expr "]"
               / "{" FieldInits? "}"
               ;
Primary        = "."? IDENT ("(" ExprList? ")")?
               / "(" Expr ")"
               / "[" ExprList? "]"
               / "{" MapInits? "}"
               / LITERAL
               ;
ExprList       = Expr ("," Expr)* ;
FieldInits     = IDENT ":" Expr ("," IDENT ":" Expr)* ;
MapInits       = Expr ":" Expr ("," Expr ":" Expr)* ;


// LITERAL
IDENT
  = (!RESERVED / RESERVED) [_a-zA-Z][_a-zA-Z0-9]*
  { return {kind: "identifier", id: text()} }
  

LITERAL
  = value:FLOAT_LIT { return { kind: "literal", type: "double", value } }
  / value:UINT_LIT { return { kind: "literal", type: "uint", value } }
  / value:INT_LIT { return { kind: "literal", type: "int", value } }
  / value:BYTES_LIT { return { kind: "literal", type: "bytes", value } } // important: check for bytes before string 
  / value:STRING_LIT { return { kind: "literal", type: "string", value } } 
  / value:BOOL_LIT { return { kind: "literal", type: "bool", value } } 
  / value:NULL_LIT { return { kind: "literal", type: "null_type", value } }

INT_LIT
  = "0x" HEXDIGIT+ { return parseInt(text(), 16) }
  / DIGIT+ { return parseInt(text(), 10) }
  

UINT_LIT     
  = int:INT_LIT [uU] { return Math.abs(int) }

FLOAT_LIT    
  = DIGIT* "." DIGIT+ EXPONENT? 
  / DIGIT+ EXPONENT { return parseFloat(text())}

DIGIT
  = [0-9]

HEXDIGIT
  = [0-9abcdefABCDEF]

EXPONENT
  = [eE] [+-]? DIGIT+

BYTES_LIT
  = [bB] str:STRING_LIT { return Uint8Array.from(  str.split("").map( c=>c.codePointAt(0) )  )}

STRING_LIT   
  = // BYTES_LIT /
  raw:[rR]? str:(
    '"""' str:( !( '"""' ) (ESCAPE / .) )* '"""' { return str.map( t => t[1] ) }
    / "'''" str:( !( "'''" ) (ESCAPE / .) )* "'''" { return str.map( t => t[1] ) }
    / '"' str:( !( '"'  / NEWLINE ) (ESCAPE / .) )* '"'   { return str.map( t => t[1] ) }
    / "'" str:( !( "'"  / NEWLINE ) (ESCAPE / .) )* "'" { return str.map( t => t[1] ) } 
  ) { return str.map( c => (raw && c.rawVal) ? c.rawVal : c.toString()).join("") } 

ESCAPE     
  = "\\" eskey:$[bfnrt"'\\] {
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

BOOL_LIT = ("true" / "false") { 
  return text()==="true" ? true : false 
}

NULL_LIT = "null" { 
  return null 
}

RESERVED
  = BOOL_LIT 
  / NULL_LIT 
  / "in"
  / "for" 
  / "if" 
  / "function" 
  / "return" 
  / "void"
  / "import" 
  / "package" 
  / "as" 
  / "let" 
  / "const"

NEWLINE 
  = "\r\n"
  / "\r"
  / "\n"


COMMENT  = '//' $(!NEWLINE .)* NEWLINE {
  return { kind: "comment", type: "single" }
}