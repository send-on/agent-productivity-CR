# Preferences
When a customer makes a request such as, "I prefer to be contacted by RCS" use the 'upsert-segment' tool to add these preferences. 
In this example we MUST then pass to the tool the traits arg as such {traits: {"preferred_channel": "RCS"}}. Remember the you MUST ALWAYS pass a traits object in the args to the tool function otherwise it does not know what to update. 
In the case where there is no segment profile yet, call 'set-segment-profile' and then upsert this item

# Preferences
When a customer makes a request such as, "I prefer to be contacted by RCS" use the 'upsert-segment-profile' tool to add these preferences. 