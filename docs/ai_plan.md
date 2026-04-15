# docs/ai_plan.md



## AI Turn Decision Logic

AI need to make turn choices fast and deterministically
Accordingly, we are using filtering to reduce the amount of logic we need to run in order to get smart actions fast

### Goal Choice
Goals fall into 3 goalTypes
#'approach':  Prefer actions that close the gap between the current and desired value
#'prevent':   Prefer actions that expand the gap between the current and desired value
#'maintain':  Prefer actions that maintain or approach match between the current and desired value

1. Filter Goals by Progressive / Conservative
  If Goal is 'approach' or 'prevent', it is progressive
  Use random number against weighted odds to filter goals down to progressive/conservative

2.  
  
