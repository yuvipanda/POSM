POIManager = (function() {
    var deleteTags = ['^source$', '^created_by$', '^AND_'];

    var shownNodeIDs = [];

    function getPOIsInBounds(bounds) {
        var d = $.Deferred();

        var sw = bounds.getSouthWest();
        var nw = bounds.getNorthEast();
        var boundsString = "(" + sw.lat + "," + sw.lng + "," + nw.lat + "," + nw.lng + ")";
        console.log(boundsString);
        startSpinImg("#show-poi");
        $.ajax({
            url: overpassBaseURL,
            data: {
                data: "node" + boundsString + ";out meta;"
            },
            dataType: "text",
            success: function(resp) {
                var $x = $($.parseXML(resp)); 
                var elements = $x.find('node'); 
                var pois = $.grep(elements, function(element) {
                    var tags = $(element).find('tag');
                    var id = $(element).attr('id');
                    var ignored_tags = 0;
                    if(tags.length) {
                        tags.each(function(i, tag) {
                            var key = $(tag).attr('k');
                            var value = $(tag).attr('v');
                            $.each(deleteTags, function(i, regex) {
                                if(key.match(new RegExp(regex))) {
                                    ignored_tags += 1;
                                }
                            });
                        });
                    }
                    return tags.length != ignored_tags && ($.inArray(id, shownNodeIDs) == -1); 
                });
                stopSpinImg("#show-poi");
                d.resolve(pois);
            },
            error: function(err) {
                d.reject(err); 
            }
        });

        return d;
    }
    
    function convertForDisplay(poi) {
        var tags = [];
        var name = "Not named";
        var $poi = $(poi);
        $poi.find('tag').each(function(i, tag) {
            $tag = $(tag);
            var key = $(tag).attr('k');
            var value = $(tag).attr('v');
            if(key == 'name') {
                name = value;
            } else {
                tags.push({'key': key, 'value': value});
            }
        });
        return {
            id: $poi.attr('id'),
            lat: $poi.attr('lat'),
            lon: $poi.attr('lon'),
            lastUpdate: $.timeago($poi.attr('timestamp')),
            lastUser: $poi.attr('user'),
            name: name,
            tags: tags,
            source: poi
        };
    }

    function savePOI(id, poi) {
        var required_attrs = ['id', 'version', 'changeset', 'lat', 'lon'];

        var d = $.Deferred();

        poi.setAttribute("changeset", currentChangesetID);

        var poiXml = (new XMLSerializer()).serializeToString(poi);

        console.log(poiXml);
        $.ajax({
            url: OSMbaseURL + '/api/0.6/node/' + id,
            type: 'POST',
            data: "<osm>" +  poiXml + "</osm>",
            beforeSend: makeBeforeSend("PUT"),
            success: function(resp) {
                d.resolve(resp);
            },
            error: function(err) {
                console.log("Failed :( " + JSON.stringify(err));
                d.reject(err);
            },
            timeout: 30 * 1000
        });

        return d;
    }
    function showPOI(poi) {
        var template = templates.getTemplate("poi-template");
        $("#poi-content").empty().html(template.render(poi));
        $.mobile.changePage('#poi-page');
        function refreshListAppearance() {
            $("#poi-tags-list > li").last().removeClass("ui-corner-bottom");
        }
        $("#poi-page").trigger("create");
        $("#new-tag-container > h3 > a").removeClass("ui-corner-top").bind('vclick', function() {
            $(this).toggleClass("ui-corner-bottom");
        });
        refreshListAppearance();
        $("#new-tag-submit").click(function() {
            var k = $.trim($("#new-tag-key").val());
            var v = $.trim($("#new-tag-value").val());
            if(k != "" && v != "") {
                $('#new-tag-container > h3 .ui-btn-text').text("Adding Tag...");
                $('#new-tag-container > h3 .ui-icon').addClass("spinner");
                var xPoi = poi.source;
                var tag = xPoi.ownerDocument.createElement('tag');
                tag.setAttribute('k', k);
                tag.setAttribute('v', v);
                xPoi.appendChild(tag);
                savePOI(poi.id, xPoi).then(function(rev) {
                    xPoi.setAttribute('version', rev);
                    $("#no-tags-item").hide();
                    $("#poi-tags-list > li").last().addClass("ui-corner-bottom");
                    $("#poi-tags-list").append("<li>" + k + ": " + v + "</li>").listview('refresh');
                    refreshListAppearance();
                    $("#new-tag-key").val("");
                    $("#new-tag-value").val("");
                    $('#new-tag-container > h3 .ui-btn-text').text("Add new tag...");
                    $('#new-tag-container > h3 .ui-icon').removeClass("spinner");
                });
            }
            return false;
        });

    }

    function displayPOIMarker(poi) {
        var d = $.Deferred();

        var poiData = convertForDisplay(poi);
        var point = new L.LatLng(poiData.lat, poiData.lon);
        var marker = new L.Marker(point);
        var popup = new L.Popup({offset: new L.Point(0, -20)}, poi);
        var popupContent = $("<div><strong>" + poiData.name + "</strong></div>").click(function() {
            showPOI(poiData);
            map.openPopup(popup);
        })[0];
        popup.setLatLng(point);
        popup.setContent(popupContent);
        marker.on('click', function() {
            map.openPopup(popup);
        });
        map.addLayer(marker);
        shownNodeIDs.push(poiData.id);

        d.resolve(marker, popup);
        return d;
    }

    function displayPOIMarkers(pois) {
        $.each(pois, function(i, poi) {
            displayPOIMarker(poi);
        });
    }
   
    function retrievePOI(id) {
        var d = $.Deferred();
        $.ajax({
            url: OSMbaseURL + '/api/0.6/node/' + id,
            type: 'GET',
            datatype: 'xml',
            beforeSend: function(xhr) {
                xhr.setRequestHeader("Authorization", "Basic " + btoa(localStorage.userName + ":" + localStorage.password));
            },
            success: function(resp) {
                var node = $(resp).find('node')[0];
                displayPOIMarker(node);
                d.resolve(node);
            },
            error: function(err) {
                console.log('no POI for id ' + id);
                console.log(JSON.stringify(err));
                d.reject(err);
            }
        });
        return d;
    }

    function createPOI(lat, lon, name) {
        var d = $.Deferred();

        var template = templates.getTemplate("node-template");
        var poiData = {
            changeset_id: currentChangesetID,
            lat: lat,
            lon: lon,
            tags: [
                {key: 'name', value: name}
            ]
        };
        var poiXml = template.render(poiData);
        console.log(poiXml);
        $.ajax({
            url: OSMbaseURL + '/api/0.6/node/create',
            type: 'POST',
            data: poiXml,
            beforeSend: makeBeforeSend("PUT"), 
            success: function(id) {
                retrievePOI(id).then(function(node) {
                    displayPOIMarker(node).then(function(marker, popup) { 
                        map.openPopup(popup);
                    });
                });
                d.resolve(id);
            },
            error: function(err) {
                console.log(JSON.stringify(err));
                d.reject(err);
            }
        });
        return d;
    }

    return {
        getPOIsInBounds: getPOIsInBounds,
        displayPOIMarkers: displayPOIMarkers,
        createPOI: createPOI,
        showPOI: showPOI,
        retrievePOI: retrievePOI,
        displayPOIMarker: displayPOIMarker
    };
})();
