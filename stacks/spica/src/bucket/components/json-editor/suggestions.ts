const examples = [
  {
    label: "Simple string equality",
    description: "Filter documents that their titles equal to 'spica'",
    text: `{
    "title": "spica"
}
`
  },
  {
    label: "Logical operator",
    description: "Filter documents that their names starts with 'jo' or ages more than 18.",
    text: `{
    "\\$or": [
        {
            "name": {
                "\\$regex": "^jo"
            }
        },
        {
            "age": {
                "\\$gt": 18
            }
        }
    ]
}
`
  }
];

export {examples};
