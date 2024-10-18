{  
  function _ltr_(left, right)  {
  
    const node = right.reduce( (left, head) => {
      return {...head, left};
    }, left); 

    if ( node.left ) {
      node.left.parent = node;
    } 
    if ( node.right ) {
      node.right.parent = node;
    }

    return node;
  }

}


Expr // "Common Expression"
  = test:ConditionalOr  WHITESPACE "?" WHITESPACE consequent:Expr WHITESPACE ":" WHITESPACE alternative:Expr
	{ 
    return {
      kind: "operator", type: "conditional", category:"tenary", test, consequent, alternative
    } 
  }    
  / ConditionalOr


ConditionalOr = left:ConditionalAnd right:(ConditionalOrOperation)* { 
  return _ltr_(left, right) 
} 
ConditionalOrOperation = WHITESPACE "||" WHITESPACE right:ConditionalAnd { 
  return {kind: "operator", type:"or", category:"binary", right} 
}


ConditionalAnd = left:Relation right:(ConditionalAndOperation)* { 
  return _ltr_(left, right) 
} 
ConditionalAndOperation = WHITESPACE "&&" WHITESPACE right:Relation { 
  return {kind: "operator", type:"and", category:"binary", right}
}


Relation = left:Addition right:(RelationOperation)* { 
  return _ltr_(left, right) 
} 
RelationOperation = WHITESPACE type:("<=" / "<" / ">=" / ">" / "==" / "!=" / "in") WHITESPACE  right:Addition { 
  return {kind: "operator", type, category:"binary", right} 
}


Addition = left:Multiplication right:(AdditionOperation)* { 
  return _ltr_(left, right)
} 
AdditionOperation = WHITESPACE type:("+" / "-") WHITESPACE right:Multiplication { 
  return {kind: "operator", type, category:"binary", right} 
}


Multiplication = left:Unary right:(MultiplicationOperation)* { 
  return _ltr_(left, right) 
} 
MultiplicationOperation = WHITESPACE type:("*" / "/" / "%") WHITESPACE right:Unary { 
  return {kind: "operator", type, category:"binary", right} 
}

Unary      
  = Member
  / "!" "!"* member:Member { return {kind: "unary", type: "not", member} }
  / "-" "-"* member:Member { return {kind: "unary", type: "negative", member} }

Member
  = left:(LITERAL / Atomic / IDENT) right:(MemberOperation)* { return _ltr_(left, right) }

MemberOperation
  =  "."  right:(Atomic / CHILDIDENT)  { return { kind: "operator", type:"select", category:"binary", right } }
  /  "["  right:Expr  "]" { return { kind: "operator", type:"index", category:"binary", right } }
  /  "{"  right:FieldInits  "}" { return { kind: "operator", type:"construct", category:"binary", right } }
  /  "("  args:ExprList  ")" { return { kind: "call", arguments: args } }
 
 
Atomic
  = "["  exprList:ExprList  "]" { return exprList }
  / "{"  mapInits:MapInits  "}" { return mapInits }
  / "("  expr:Expr  ")" { return expr }
  / "."  primary:CHILDIDENT { return {kind: "operator", type: "fully_qualify", category:"unary", primary}}

ExprList = WHITESPACE left:(Expr / "") WHITESPACE right:("," WHITESPACE expr:Expr WHITESPACE {return expr})* {
	const expressions = left != "" ? [left] : [];
	if (right) {
		expressions.push(...right);
	} 
	return expressions;
}
FieldInits     = IDENT ":" Expr ("," IDENT ":" Expr)*
MapInits       = Expr ":" Expr ("," Expr ":" Expr)*


// LEXIS
IDENT = !RESERVED [_a-zA-Z][_a-zA-Z0-9]*  { 
	return {kind: "identifier", name: text()} 
}

CHILDIDENT = [_a-zA-Z][_a-zA-Z0-9]*  { 
	return {kind: "identifier", name: text()} 
}

LITERAL = value:FLOAT_LIT { return { kind: "literal", type: "double", value } }
        / value:UINT_LIT { return { kind: "literal", type: "uint", value } }
        / value:INT_LIT { return { kind: "literal", type: "int", value } }
        / value:BYTES_LIT { return { kind: "literal", type: "bytes", value } }
        / value:STRING_LIT { return { kind: "literal", type: "string", value } } 
        / value:BOOL_LIT { return { kind: "literal", type: "bool", value: value == "true" } } 
        / NULL_LIT { return { kind: "literal", type: "null", value: null } }

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
RESERVED       = ( BOOL_LIT / NULL_LIT / "in"
                 / "as" / "break" / "const" / "continue" / "else"
                 / "for" / "function" / "if" / "import" / "let"
                 / "loop" / "package" / "namespace" / "return"
                 / "var" / "void" / "while" ) ![_a-zA-Z0-9]
WHITESPACE     = [\t\n\f\r ]*
COMMENT        = '//'
