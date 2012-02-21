curPosManager = (function() {

    var curPosIconClass = L.Icon.extend({
        iconUrl: "img/curpos.png",
        shadowUrl: null,
        iconSize: new L.Point(40, 40),
        iconAnchor: new L.Point(20, 20)
    });
    var curPosIcon = new curPosIconClass();
    var curPos = null;
    var accuracyCircle = null;

    function showPosition(latlng, accuracy) {
        if(updateLocation) {
            console.log("showing position");
            if(curPos || accuracyCircle) {
                map.removeLayer(accuracyCircle);
                console.log('removed layers in add!');
                map.removeLayer(curPos);
            }

            curPos = new L.Marker(latlng, {icon: curPosIcon});
            accuracyCircle  = new L.Circle(latlng, accuracy, {opacity: 0.1, weight: 1, clickable: false});
            map.addLayer(curPos);
            console.log('added layers!');
            map.addLayer(accuracyCircle);
        }

    }

    var watchID = null;
    function startWatching() {
        if(watchID === null) {
            watchID = navigator.geolocation.watchPosition(
                    function(pos) {
                        showPosition(new L.LatLng(pos.coords.latitude, pos.coords.longitude), pos.coords.accuracy);
                    }, function(err) {
                        console.log(JSON.stringify(err));
                    }, {enableHighAccuracy: true}
                );
        }

    }

    function stopWatching() {
        navigator.geolocation.clearWatch(watchID);
        watchID = null;
        map.removeLayer(accuracyCircle);
        console.log('removed layers!');
        map.removeLayer(curPos);
    }  

    return {
        startWatching: startWatching,
        stopWatching: stopWatching,
        showPosition: showPosition
    };

})();
