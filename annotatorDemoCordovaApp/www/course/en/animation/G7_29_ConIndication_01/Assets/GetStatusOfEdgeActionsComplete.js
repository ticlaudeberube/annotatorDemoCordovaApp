var count = 0;
//ids of buttons on which has an action.
var actionButtonIds = ["Stage_HL_HydPnl", "Stage_HL_HydSyn"];
//specify total no of inteaction if 0 then it's take default i.e  total buttons intraction
var completedOnTotalInteraction=0||actionButtonIds.length;
if(completedOnTotalInteraction>actionButtonIds.length+1){
    throw "Please Enter value of completedOnTotalInteraction less than actionButtonIds total length";
}

function whenAvailable(name, callback) {
    var interval = 10; // ms
    window.setTimeout(function() {
        if (window[name]) {
            callback(window[name]);
        } else {
            window.setTimeout(arguments.callee, interval);
        }
    }, interval);
}

// alternative to $(document).ready() event
document.addEventListener("DOMContentLoaded", function(event) {
    whenAvailable("AdobeEdge", function() {
    //your code to run since DOM is loaded and ready
        window.AdobeEdge.bootstrapCallback(function(compId) {
        if (compId && compId.length > 0)
            onEdgeAnimationLoaded(compId);
        });
    });
});

function onEdgeAnimationLoaded(compId) {
    new ActionCompletion().bindEvent();
}
//*************Start****************************//
// below code is to find completion status of the content
// you can change this code as per your requirement
var ActionCompletion = function() {
        //bind click event to buttons for check buttons are clicked(visited)
        this.bindEvent = function() {
                for (var i = 0, length = actionButtonIds.length; i < length; i++) {
                    el = document.getElementById(actionButtonIds[i]);
                    el.addEventListener("click", actionCompletion, false);
                    //$('#' + actionButtonIds[i]).on('click', actionCompletion);
                }
            }
        //check for all action are complated or not and also count the no of action.
        var actionCompletion = function(event) {
           // $(event.currentTarget).off('click', actionCompletion);
            event.currentTarget.removeEventListener('click', actionCompletion, false);
            count++;
            if (count === completedOnTotalInteraction) {
                setCompletionStatus(true);
            }
        }
    }
//*****************End***************************//
//This function trigger Event to adapt iFrame components once the all action(interaction) complated.
function setCompletionStatus(completionStatus) {
    var parentWindow = window.parent;
    parentWindow.$(window.frameElement).trigger('completion:status', [completionStatus]);
}