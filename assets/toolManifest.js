const toolManifest = {
    "tools": [
        {
            "type": "function",
            "function": {
                "name": "get-customer",
                "description": "Retrieves customer details based on the call 'from' information",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "from": {
                            "type": "string",
                            "description": "The phone number of the customer (caller)"
                        }
                    },
                    "required": [
                        "from"
                    ]
                }
            }
        },
        {
            "type": "function",
            "function": {
                "name": "update-customer-profile",
                "description": "Updates the segment customer profile with new traits",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "userId": {
                            "type": "string",
                            "description": "The userId of the customer"
                        },
                        "home_price": {
                            "type": "string",
                            "description": "The price of the home"
                        },
                        "home_type": {
                            "type": "string",
                            "description": "The type of home of the customer is looking to buy"
                        },
                        "home_use": {
                            "type": "string",
                            "description": "The intended use of the home - rental, primary_residence or vacation home"
                        },
                        "situation_goals": {
                            "type": "string",
                            "description": "An explanation of the customer's situation and what they are trying to achieve."
                        }
                    },
                    "required": [
                        "userId"
                    ]
                }
            }
        },
        {
            "type": "function",
            "function": {
                "name": "live-agent-handoff",
                "description": "Hands the call to a live agent",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "callSid": {
                            "type": "string",
                            "description": "The unique identifier of the call to be transferred"
                        }
                    },
                    "required": [
                        "callSid"
                    ]
                }
            }
        },
        {
          "type": "function",
          "function": {
              "name": "lookup-mortgage-with-phone",
              "description": "Lookups up existing mortgage details for the customer phone number",
              "parameters": {
                "type": "object",
                "properties": {
                  "type": {
                    "type": "string",
                    "description": "The type of identifier to use for the lookup. Can be 'phone' or 'name'."
                  }, 
                  "value": {
                    "type": "string",
                    "description": "The value of the identifier.  If type is a phone number then value is the phone number of the customer (caller)"
                  }
                },
                "required": [
                  "type", "value", 
                ]
              }
            }
          },
          {
            "type": "function",
            "function": {
                "name": "upsert-mortgage",
                "description": "Upserts mortgage details into database and is used when customer provides new information about their loan application",
                "parameters": {
                  "type": "object",
                  "properties": {
                    "loan_application_id": {
                      "type": "string",
                      "description": "The loan application id that is incomplete"
                    },
                    "data": {
                      "type": "object",
                      "description": "Object containing the mortgage data to be upserted where the key is the column name in the table and the value is the value to be upserted.",
                    }
                  },
                  "required": [
                    "loan_application_id", "data"
                  ]
                }
              }
            }
        ]
      }
   

module.exports = { toolManifest };
