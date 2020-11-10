// Based on https://github.com/somombo/facl/blob/master/src/parser/cel.grammer.pegjs

{  
  function __cel$ltr__(lhs, rhs)  { 
    return rhs.reduce( (t,h) => ({...h, lhs: t}), lhs) 
  }  
}

__Start__ =  (Comment / EndOfLine)*    expr:(Expression) {
  return expr;
}

// Ignorables

EndOfLine
  = "\r\n"
  / "\r"
  / "\n"

Space = [ \t]
  
Comment  = '//' $(!EndOfLine .)* EndOfLine {
  return { kind: "comment", type: "single" }
}

MultiLineComment "Multi-line Comment"  
  = '/*' $(!'*/' .)* '*/'  {return { kind: "comment", type: "multi" }}

// Data Structures 
List
  = all:
  (
    lhs:Expression  rhs:(","  e:Expression {return e})* 
    { return { kind: "iterable", type: "list", list: [lhs, ...rhs] } }
  )? 
  { return all ? all : { kind: "iterable", type: "list", list: [] }}

Dictionary 
  = all:
  (
    lhs:(k:identifier  ":"  v:Expression {return [k,v]})  
    rhs:(","  k:identifier  ":"  v:Expression {return [k,v]})* 
    { return { kind: "iterable", type: "dictionary", list: [lhs, ...rhs] } }    
  )? 
  { return all ? all : { kind: "iterable", type: "dictionary", list: [] }}

Map
  = all:
  (
    lhs:(k:Expression  ":"  v:Expression {return [k,v]})  
    rhs:(","  k:Expression  ":"  v:Expression {return [k,v]})*
    { return { kind: "iterable", type: "map", list: [lhs, ...rhs] } }
  )? 
  { return all ? all : { kind: "iterable", type: "map", list: [] }}


Expression // "Common Expresxsion"
  = t:ConditionalOr  "?"  s:Expression  ":"   p:Expression
	{ return {kind: "operator", type: "conditional", category:"tenary", primary:p, rhs:p, tertiary:t} }    
  / ConditionalOr


ConditionalOr = lhs:ConditionalAnd rhs:(ConditionalOrOperation)* { 
  return __cel$ltr__(lhs, rhs) 
} 
ConditionalOrOperation =  "||"  rhs:ConditionalAnd { 
  return {kind: "operator", type:"or", category:"binary", rhs} 
}


ConditionalAnd = lhs:Relation rhs:(ConditionalAndOperation)* { 
  return __cel$ltr__(lhs, rhs) 
} 
ConditionalAndOperation = "&&" rhs:Relation { 
  return {kind: "operator", type:"and", category:"binary", rhs}
}


Relation = lhs:Addition rhs:(RelationOperation)* { 
  return __cel$ltr__(lhs, rhs) 
} 
RelationOperation = type:RELATION_SYMBOL  rhs:Addition { 
  return {kind: "operator", type, category:"binary", rhs} 
}
RELATION_SYMBOL      
  = "<" {return 'less'}
  / "<=" {return 'lessOrEqual'}
  / ">=" {return 'greaterOrEqual'}
  / ">" {return 'greater'}
  / "==" {return 'equal'}
  / "!=" {return 'notEqual'}
  / " in " {return 'in'}

Addition = lhs:Multiplication rhs:(AdditionOperation)* { 
  return __cel$ltr__(lhs, rhs)
} 
AdditionOperation = type:SUM_SYMBOL rhs:Multiplication { 
  return {kind: "operator", type, category:"binary", rhs} 
}
SUM_SYMBOL 
  = "+" {return 'add'}
  / "-" {return 'subtract'}


Multiplication = lhs:Unary rhs:(MultiplicationOperation)* { 
  return __cel$ltr__(lhs, rhs) 
} 
MultiplicationOperation = type:("*" / "/" / "%")  rhs:Unary { 
  return {kind: "operator", type, category:"binary", rhs} 
}

Unary      
  = Member
  / "!" "!"* member:Member { return {kind: "unary", type: "not", member} }
  / "-" "-"* member:Member { return {kind: "unary", type: "negative", member} }

Member
  = lhs:(literal / Atomic) rhs:(MemberOperation)* { return __cel$ltr__(lhs, rhs) }

MemberOperation
  =  "."  rhs:Atomic { return { kind: "operator", type:"select", category:"binary", rhs } }
  /  "["  rhs:Expression  "]" { return { kind: "operator", type:"index", category:"binary", rhs } }
  /  "{"  rhs:Dictionary  "}" { return { kind: "operator", type:"construct", category:"binary", rhs } }
  /  "("  rhs:List  ")" { return { kind: "macro", rhs } }
 
 
Atomic
  = "["  exprList:List  "]" { return exprList }
  / "{"  mapInits:Map  "}" { return mapInits }
  / "("  expr:Expression  ")" { return expr }
  / "."  primary:identifier { return {kind: "operator", type: "fully_qualify", category:"unary", primary}}
  / identifier



// Literals

identifier
  = (!RESERVED / RESERVED) [_a-zA-Z][_a-zA-Z0-9]*
  { return {kind: "identifier", id: text()} }
  

literal
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
    / '"' str:( !( '"'  / EndOfLine ) (ESCAPE / .) )* '"'   { return str.map( t => t[1] ) }
    / "'" str:( !( "'"  / EndOfLine ) (ESCAPE / .) )* "'" { return str.map( t => t[1] ) } 
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