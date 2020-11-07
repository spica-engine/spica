// Based on https://github.com/somombo/facl/blob/master/src/parser/cel.grammer.pegjs

{  
  function __cel$ltr__(lhs, rhs)  { 
    return rhs.reduce( (t,h) => ({...h, lhs: t}), lhs) 
  }  
}

__Start__ =  (Comment / EndOfLine)*  Spacing  expr:(Expression) {
  return expr;
}

// Ignorables

EndOfLine
  = "\r\n"
  / "\r"
  / "\n"

Space = [ \t]
  
Spacing = (Space / MultiLineComment / EndOfLine)*

Comment  = '//' $(!EndOfLine .)* EndOfLine {
  return { kind: "comment", type: "single" }
}

MultiLineComment "Multi-line Comment"  
  = '/*' $(!'*/' .)* '*/'  {return { kind: "comment", type: "multi" }}

// Data Structures 
List
  = all:
  (
    lhs:Expression Spacing rhs:("," Spacing e:Expression {return e})* 
    { return { kind: "iterable", type: "list", list: [lhs, ...rhs] } }
  )? 
  { return all ? all : { kind: "iterable", type: "list", list: [] }}

Dictionary 
  = all:
  (
    lhs:(k:identifier Spacing ":" Spacing v:Expression {return [k,v]}) Spacing 
    rhs:("," Spacing k:identifier Spacing ":" Spacing v:Expression {return [k,v]})* 
    { return { kind: "iterable", type: "dictionary", list: [lhs, ...rhs] } }    
  )? 
  { return all ? all : { kind: "iterable", type: "dictionary", list: [] }}

Map
  = all:
  (
    lhs:(k:Expression Spacing ":" Spacing v:Expression {return [k,v]}) Spacing 
    rhs:("," Spacing k:Expression Spacing ":" Spacing v:Expression {return [k,v]})*
    { return { kind: "iterable", type: "map", list: [lhs, ...rhs] } }
  )? 
  { return all ? all : { kind: "iterable", type: "map", list: [] }}


Expression // "Common Expression"
  = t:Disjunction Spacing "?" Spacing s:Expression Spacing ":"  Spacing p:Expression
	{ return {kind: "operator", type: "conditional", category:"tenary", primary:p, rhs:s, tertiary:t} }    
  / Disjunction


Disjunction // "OR"
  = lhs:Conjunction rhs:(DisjunctionOperation)* { return __cel$ltr__(lhs, rhs) } 
DisjunctionOperation
  = Spacing "||" Spacing rhs:Conjunction 
  { return {kind: "operator", type:"or", category:"binary", rhs} }


Conjunction // "AND"
  = lhs:Relation rhs:(ConjunctionOperation)* { return __cel$ltr__(lhs, rhs) } 
ConjunctionOperation
  = Spacing "&&" Spacing rhs:Relation 
  { return {kind: "operator", type:"and", category:"binary", rhs} }


Relation // >,<,= etc
  = lhs:Addition rhs:(RelationOperation)* { return __cel$ltr__(lhs, rhs) } 
RelationOperation
  = Spacing type:RELATION_SYMBOL Spacing rhs:Addition 
  { return {kind: "operator", type, category:"binary", rhs} }
RELATION_SYMBOL      
  = "<" {return 'less'}
  / "<=" {return 'lessOrEqual'}
  / ">=" {return 'greaterOrEqual'}
  / ">" {return 'greater'}
  / "==" {return 'equal'}
  / "!=" {return 'notEqual'}
  // / " in " {return 'in'}

Addition // +,-
  = lhs:Multiplication rhs:(AdditionOperation)* { return __cel$ltr__(lhs, rhs) } 
AdditionOperation
  = Spacing type:SUM_SYMBOL Spacing rhs:Multiplication 
  { return {kind: "operator", type, category:"binary", rhs} }
SUM_SYMBOL
  = "+" {return 'add'}
  / "-" {return 'subtract'}


Multiplication // *,/,%
  = lhs:Unary rhs:(MultiplicationOperation)* { return __cel$ltr__(lhs, rhs) } 
MultiplicationOperation
  = Spacing type:PRODUCT_SYMBOL Spacing rhs:Unary 
  { return {kind: "operator", type, category:"binary", rhs} }
PRODUCT_SYMBOL
  = "*" {return 'multiply'}
  / "/" {return 'divide'}
  / "%" {return 'remainder'}

Unary      
  = ("!" Spacing)+ primary:Member { return {kind: "operator", type: "not", category:"unary", primary} }
  / ("-" Spacing)+ primary:Member { return {kind: "operator", type: "negative", category:"unary", primary} }
  / Member


Member
  = lhs:(literal / Atomic) rhs:(MemberOperation)* { return __cel$ltr__(lhs, rhs) }
MemberOperation
  = Spacing "." Spacing rhs:Atomic { return { kind: "operator", type:"select", category:"binary", rhs } }
  / Spacing "[" Spacing rhs:Expression Spacing "]" { return { kind: "operator", type:"index", category:"binary", rhs } }
  / Spacing "{" Spacing rhs:Dictionary Spacing "}" { return { kind: "operator", type:"construct", category:"binary", rhs } }
  / Spacing "(" Spacing rhs:List Spacing ")" { return { kind: "macro", rhs } }
 
 
Atomic
  = "[" Spacing exprList:List Spacing "]" { return exprList }
  / "{" Spacing mapInits:Map Spacing "}" { return mapInits }
  / "(" Spacing expr:Expression Spacing ")" { return expr }
  / "." Spacing primary:identifier { return {kind: "operator", type: "fully_qualify", category:"unary", primary}}
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