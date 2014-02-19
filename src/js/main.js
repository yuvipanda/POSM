var map = null;

var currentChangesetID = null;
var OSMbaseURL = 'http://api.openstreetmap.org';
var overpassBaseURL = 'http://overpass.osm.rambler.ru/cgi/interpreter';
var autoPOI = false;
var updateLocation = true;
var mapTapBar = null;
var poiTapBar = null;
var bingTiles = null;
var osmTiles = null;

var bingMode = false;

var newMarkerIconClass = L.Icon.extend({
    iconUrl: "img/new-marker.png",
});
var newMarkerIcon = new newMarkerIconClass();

var mapTapBarStates = {
    "login-start": {
        text: "Login",
        callback: function() {
            $("#login").click();
        }
    },
    "login-in-progress": {
        text: "Logging in",
        disabled: true
    },
    "login-failed": {
        text: "Logged in!",
        disabled: true,
        next: 'create-poi-start'
    },
    "login-success": {
        text: "Logged in!",
        disabled: true,
        next: 'create-poi-start'
    },
    "create-poi-start": {
        text: "Create POI",
        callback: function() {
            console.log("Creating poi");
            startAdd();
        }
    },
    "create-poi-place": {
        text: "Tap on location in map",
        disabled: true
    },
    "create-poi-save": {
        text: "Save location",
        callback: function() {
            stopAdd();
        }
    },
    "create-poi-failed": {
        text: "Creating Failed :(",
        disabled: true,
        next: 'create-poi-start'
    }, 
    "create-poi-cancelled": {
        text: "Creating Cancelled",
        disabled: true,
        next: 'create-poi-start'
    }, 
    "create-poi-creating": {
        text: "Creating...",
        disabled: true
    }, 
    "create-poi-created": {
        text: "Created!",
        disabled: true,
        next: 'create-poi-start'
    }
};

var poiTapBarStates = {
    "empty": {
        text: "",
        disabled: true
    },
    "save": {
        text: "Save",
        callback: function() {
            // Hacky code for now. Need to figure out best way to maintain 'curPOI' state
            $("#save-poi").trigger('vclick');
        }
    }, 
    "saving": {
        text: "Saving...",
        disabled: true
    },
    "saved": {
        text: "Saved!",
        disabled: true,
        next: "empty"
    },
    "save-failed": {
        text: "Saving failed :(",
        disabled: true,
        next: "save"
    }
};

function onBodyLoad() {
    if(window.PhoneGap.available) {
        document.addEventListener("deviceready", function() { init(); }, true);
        document.addEventListener("resume", curPosManager.startWatching, false);
        document.addEventListener("pause", curPosManager.stopWatching, false);
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
    $(window).bind('orientationchange resize', resizeContentArea);
    $("#map-page").bind('pageshow', resizeContentArea);
    map = new L.Map('map');

    osmTiles = new L.TileLayer('http://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: 'Map data &copy; 2012 OpenStreetMap contributors'
    });

    bingTiles = new L.TileLayer.Bing(creds.bing, "Aerial");	

    map.setView(new L.LatLng(0, 0), 2);
    map.addLayer(osmTiles);
    map.locateAndSetView(18, {enableHighAccuracy: true});
    map.on('locationfound', function(pos) {
        curPosManager.showPosition(pos.latlng, pos.accuracy);
    });
    resizeContentArea();

    map.on('zoomend', function(ev) {
        if(map.getZoom() >= 3 && !autoPOI) {
            $("#show-poi").click();
        } else if(map.getZoom() < 3 && autoPOI) {
            $("#show-poi").click();
        }
    });

    map.on('click', function(event) {
        if(adding) { 
            if(addMarker === null) {
                 addMarker = new L.Marker(event.latlng, {draggable: true, icon: newMarkerIcon});
                 map.addLayer(addMarker);
                 mapTapBar.setState("create-poi-save");
            }
        }
    });
    map.on('moveend', function(event) {
        if(autoPOI) {
            updatePOIs();
        }
        return true;
    });

    // According to https://groups.google.com/group/leaflet-js/browse_thread/thread/2959ba3af68e537a
    $("#map-page").bind("pageshow", function() {
        setTimeout(function() {
            map.invalidateSize();
        }, 300);
    });

}

var addMarker = null;

function updatePOIs() {
    var bounds = map.getBounds();
    POIManager.getPOIsInBounds(bounds).done(POIManager.displayPOIMarkers);
};

var adding = false;
function startAdd() {
    adding = true;
    mapTapBar.setState("create-poi-place");
    $("#add-poi").find('img').attr('src', 'img/save.png');
}

function stopAdd() {
    if(addMarker !== null) {
        mapTapBar.setState("create-poi-creating");
        var name = prompt("Enter name");
        if(!name) {
            var create = confirm("Create nameless tag?");
            if(!create) {
                map.removeLayer(addMarker);
                addMarker = null;
                mapTapBar.setState("create-poi-cancelled");
                return;
            }
        }
        var latlng = addMarker.getLatLng();
        POIManager.createPOI(latlng, name).then(function() {
            map.removeLayer(addMarker);
            addMarker = null;
            mapTapBar.setState("create-poi-created");
        }).fail(function() {
            map.removeLayer(addMarker);
            addMarker = null;
            mapTapBar.setState("create-poi-failed");
        });
    }
    adding = false;
}

function startSpinning(selector) {
    $(selector).addClass("spinner");
}

function stopSpinning(selector) {
    $(selector).removeClass("spinner");
}

$(function() {
    mapTapBar = new TapBar("#map-tap-bar", mapTapBarStates);
    poiTapBar = new TapBar("#poi-tap-bar", poiTapBarStates);
    poiTapBar.setState("empty");
    $(".img-btn").bind('vmousedown', function() {
        if(!$(this).attr("disabled")) {
            $(this).addClass("ui-btn-down-e");
        }
    }).bind('vmouseup', function() {
        if(!$(this).attr("disabled")) {
            $(this).removeClass("ui-btn-down-e");
        }
    });
    $(".img-toggle").click(function() {
        if($(this).attr('pressed')) {
            $(this).removeClass("ui-btn-down-e");
            $(this).removeAttr('pressed');
        } else {
            $(this).attr("pressed", "pressed");
            $(this).addClass("ui-btn-down-e");
        }
    });

    $("#show-poi").click(function() {
        autoPOI = !autoPOI;
        if(autoPOI) {
            updatePOIs();
        }
    });

    $("#current-location").click(function() {
        map.locateAndSetView(map.getZoom(), {enableHighAccuracy: true});
    });

    $("#bing-layer").click(function() {
        if(bingMode) {
            map.removeLayer(bingTiles);
        } else {
            map.addLayer(bingTiles);
        }
        bingMode = !bingMode;
    });


    $("#login").click(function() {
        $("#login-user-id").val(localStorage.userName);
        // Death by electrocution and a thousand hours of using PHP 3
        $("#login-password").val(localStorage.password);
        $.mobile.changePage("#login-dialog");
    });

    $("#save-login").click(function() {
        localStorage.userName = $.trim($("#login-user-id").val());
        localStorage.password = $.trim($("#login-password").val());
        $.mobile.showPageLoadingMsg();
        changesets.createChangeset().then(function(id) {
            currentChangesetID = id;
            $.mobile.hidePageLoadingMsg();
            mapTapBar.setState("create-poi-start");
            history.back();
        }).fail(function(err) {
            console.log(JSON.stringify(err));
            $.mobile.hidePageLoadingMsg();
            if(err.statusText == "timeout") {
                alert("Network too slow");
            } else {
                alert("Error logging in. Wrong password?");
            }
        });
        return false;
    });

    // Because doing it immediately makes things block. WTF?
    setTimeout(function() {
        if(localStorage.userName && localStorage.password) {
            mapTapBar.setState("login-in-progress");
            changesets.createChangeset().done(function(id) {
                currentChangesetID = id;
                mapTapBar.setState("login-success");
            }).fail(function() {
                mapTapBar.setState("login-failed");
            })
        } else {
            mapTapBar.setState("login-start");
        }
    }, 300);
});

// getBeforeSend - return function that adds basic authentication and fakes request method.
function makeBeforeSend(method) {
    return function(xhr) {
        xhr.setRequestHeader("X_HTTP_METHOD_OVERRIDE", method);
        xhr.setRequestHeader("Authorization", "Basic " + btoa(localStorage.userName + ":" + localStorage.password));
    };
}


