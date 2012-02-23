window.changesets = (function() {
    function createChangeset() {
        var d = $.Deferred();
        $.ajax({
            url: OSMbaseURL + '/api/0.6/changeset/create',
            type: 'POST',
            // Need a way to properly do this, but bah
            data: "<osm><changeset><tag k='created_by' v='POIOISM' /><tag k='comment' v='testing' /></changeset></osm>",
            beforeSend: makeBeforeSend("PUT"),
            success: function(resp) {
                d.resolve(resp);
            },
            error: function(err) {
                d.reject(err);
            },
            timeout: 30 * 1000
        });

        return d;
    }

    function isChangesetActive(changset_id) {
        var d = $.Deferred();

        $.ajax({
            url: OSMbaseURL + '/api/0.6/changeset/' + changeset_id,
            type: 'GET',
            success: function(resp) {
                d.resolve($(resp).find('changeset').attr('open') == 'true');
            },
            error: function(err) {
                d.reject(err);
            }
        });

        return d;
    }

    return {
        createChangeset: createChangeset,
        isChangesetActive: isChangesetActive
    };

})();
