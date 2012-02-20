var map = null;

var currentChangesetID = null;
var OSMbaseURL = 'http://api.openstreetmap.org';
var overpassBaseURL = 'http://overpass.osm.rambler.ru/cgi/interpreter';

function onBodyLoad() {
    if(window.PhoneGap.available) {
        document.addEventListener("deviceready", function() { init(); }, true);
    } else {
        $(function() {
            if(location.href.match(/^http/)) {
                OSMbaseURL = "/osm";
                overpassBaseURL = '/overpass';
            }
            init();
        });
    }
}

document.addEventListener("mobileinit", function() {
    $.mobile.page.prototype.options.backBtnText = "";
}, true);

function resizeContentArea() {
    var content, contentHeight, footer, header, viewportHeight;
    window.scroll(0, 0);
    header = $(":jqmData(role='header'):visible");
    footer = $(":jqmData(role='footer'):visible");
    content = $(":jqmData(role='content'):visible");
    viewportHeight = $(window).height();
    contentHeight = viewportHeight - header.outerHeight() - footer.outerHeight();
    $("article:jqmData(role='content')").first().height(contentHeight);
    return $("#map").height(contentHeight);
  };

function init() {
    $(window).bind('orientationchange pageshow resize', resizeContentArea);
    map = new L.Map('map');

    var tiles = new L.TileLayer('http://otile{s}.mqcdn.com/tiles/1.0.0/osm/{z}/{x}/{y}.png', {
        subdomains: '1234', // for MapQuest tiles
        //attribution: 'Map data &copy; 2011 OpenStreetMap contributors'
        attribution: 'Tiles Courtesy of <a href="http://www.mapquest.com/" target="_blank">MapQuest</a> <img src="http://developer.mapquest.com/content/osm/mq_logo.png">. Map data &copy; 2012 OpenStreetMap contributors'
    });

    map.addLayer(tiles);
    map.locateAndSetView(20, {enableHighAccuracy: true});
    map.on('locationfound', function() {
        console.log("Location found");
    });
    resizeContentArea();

    map.on('click', function(event) {
        if(adding) { 
            var name = prompt("Enter name");
            POIManager.createPOI(event.latlng.lat, event.latlng.lng, name);
            stopAdd();
        }
    });
}

var adding = false;
function startAdd() {
    adding = true;
}

function stopAdd() {
    adding = false;
}

$(function() {
    $("#add-poi").click(function() {
        startAdd();
    });
    $("#current-location").click(function() {
        map.locateAndSetView();
    });

    $("#map-page").bind('pageshow', function(page) {
        if(currentChangesetID) {
            $("#logged-out-footer").hide();
            $("#logged-in-footer").show();
        } else {
            $("#logged-in-footer").hide();
            $("#logged-out-footer").show();
        }
    });

    $("#show-poi").click(function() {
        var bounds = map.getBounds();
        POIManager.getPOIsInBounds(bounds).done(POIManager.displayPOIs);
    });

    $("#login").click(function() {
        $("#login-user-id").val(localStorage.userName);
        // Death by electrocution and a thousand hours of using PHP 3
        $("#login-password").val(localStorage.password);
        $.mobile.changePage("#login-dialog");
    });

    $("#save-login").click(function() {
        localStorage.userName = $("#login-user-id").val();
        localStorage.password = $("#login-password").val();
        $.mobile.showPageLoadingMsg();
        $.ajax({
            url: OSMbaseURL + '/api/0.6/changeset/create',
            type: 'POST',
            // Need a way to properly do this, but bah
            data: "<osm><changeset><tag k='created_by' v='POIOISM' /><tag k='comment' v='testing' /></changeset></osm>",
            beforeSend: function(xhr) {
                xhr.setRequestHeader("X_HTTP_METHOD_OVERRIDE", "PUT");
                xhr.setRequestHeader("Authorization", "Basic " + btoa(localStorage.userName + ":" + localStorage.password));
            },
            success: function(resp) {
                currentChangesetID = resp;
                $.mobile.hidePageLoadingMsg();
                history.back();
            },
            error: function(err) {
                console.log("error :(");
                console.log(JSON.stringify(err));
                $.mobile.hidePageLoadingMsg();
                alert('Wrong Password!');
            }
        });
    });
});
