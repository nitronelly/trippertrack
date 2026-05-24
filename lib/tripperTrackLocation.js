import BackgroundGeolocation from "react-native-background-geolocation";
import { supabase } from "./supabase";

let isReady = false;
let currentEventId = null;
let currentUserId = null;

async function upsertLivePresence(location) {
    if (!currentEventId || !currentUserId) {
        console.log("TT_TS_SKIP_NO_EVENT_OR_USER");
        return;
    }

    const coords = location.coords;

    const row = {
        event_id: currentEventId,
        user_id: currentUserId,
        latitude: coords.latitude,
        longitude: coords.longitude,
        accuracy_m: coords.accuracy,
        battery_percent: null,
        broadcasting: true,
        updated_at: new Date().toISOString(),
        last_movement_at: new Date().toISOString(),
    };

    const { error } = await supabase
        .from("live_presence")
        .upsert(row, {
            onConflict: "event_id,user_id",
        });

    if (error) {
        console.log("TT_TS_UPSERT_FAIL", error.message);
        return;
    }

    console.log("TT_TS_UPSERT_OK", {
        lat: row.latitude,
        lng: row.longitude,
        accuracy: row.accuracy_m,
    });
}

export async function initTripperTrackLocation() {
    if (isReady) return;



    BackgroundGeolocation.onLocation(
        async (location) => {
            // console.log("TT_TS_LOCATION", {
            //   lat: location.coords.latitude,
            //   lng: location.coords.longitude,
            //   accuracy: location.coords.accuracy,
            // });

             await upsertLivePresence(location);
        },
        (error) => {
            //   console.log("TT_TS_LOCATION_ERROR", error);
        }
    );

    BackgroundGeolocation.onProviderChange((event) => {
        console.log("TT_TS_PROVIDER_CHANGE", event);
    });

    BackgroundGeolocation.onHttp((response) => {
        /* console.log("TT_TS_HTTP", {
             success: response.success,
             status: response.status,
             responseText: response.responseText,
         });*/
    });

    BackgroundGeolocation.onMotionChange(async (event) => {
        /* console.log("TT_TS_MOTION_CHANGE", {
             isMoving: event.isMoving,
             lat: event.location?.coords?.latitude,
             lng: event.location?.coords?.longitude,
             accuracy: event.location?.coords?.accuracy,
         });*/

        if (event.location) {
              await upsertLivePresence(event.location);
        }
    });

    BackgroundGeolocation.onHeartbeat(async () => {
        try {
            console.log("TT_TS_HEARTBEAT");

            const location = await BackgroundGeolocation.getCurrentPosition({
                samples: 1,
                persist: false,
            });

            // await upsertLivePresence(location);
        } catch (e) {
            console.log("TT_TS_HEARTBEAT_ERROR", e);
        }
    });


    const state = await BackgroundGeolocation.ready({
        desiredAccuracy: BackgroundGeolocation.DESIRED_ACCURACY_HIGH,
        distanceFilter: 3,
        stopTimeout: 1,
        heartbeatInterval: 60,
        stopOnTerminate: false,
        startOnBoot: true,
        foregroundService: true,
        enableHeadless: false,
        stopOnStationary: false,
        pausesLocationUpdatesAutomatically: false,
        disableStopDetection: true,
        locationAuthorizationRequest: "Always",

        debug: false,
        logLevel: BackgroundGeolocation.LOG_LEVEL_VERBOSE,

        notification: {
            title: "TripperTrack is active",
            text: "Sharing your live location with your crew",
            channelName: "TripperTrack location",
        },
    });

    if (!state.enabled) {
        console.log("TT_TS_STARTING");

        await BackgroundGeolocation.start();
    } else {
        console.log("TT_TS_ALREADY_RUNNING");
    }
    isReady = true;

    console.log("TT_TS_READY", {
        enabled: state.enabled,
        trackingMode: state.trackingMode,
    });
}

export async function startTripperTrackLocation({ eventId, userId }) {
    currentEventId = eventId;
    currentUserId = userId;

    await initTripperTrackLocation();

    console.log("TT_TS_SET_CONFIG_START");

    await BackgroundGeolocation.setConfig({
       // url: "https://jimbbuwuafyfuvaszdcx.supabase.co/functions/v1/update-live-presence",
      //  method: "POST",
        autoSync: false,
        batchSync: false,

       /* headers: {
            "Content-Type": "application/json",
            "apikey": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImppbWJidXd1YWZ5ZnV2YXN6ZGN4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ5OTkyMTksImV4cCI6MjA5MDU3NTIxOX0.fpHihBfIyVpEOqlUlhpZFWtXgnM4E7cS1Im0UfyPxRU",
            "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImppbWJidXd1YWZ5ZnV2YXN6ZGN4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ5OTkyMTksImV4cCI6MjA5MDU3NTIxOX0.fpHihBfIyVpEOqlUlhpZFWtXgnM4E7cS1Im0UfyPxRU",
        },

        params: {

            eventId,
            userId,
        },

        locationTemplate:
            '{"eventId":"' + eventId + '","userId":"' + userId + '","latitude":<%= latitude %>,"longitude":<%= longitude %>,"accuracyM":<%= accuracy %>,"batteryPercent":<%= battery.level %>,"isMoving":<%= is_moving %>,"timestamp":"<%= timestamp %>"}',*/
    });

    console.log("TT_TS_NATIVE_UPLOAD_CONFIGURED", {
        eventId: currentEventId,
        userId: currentUserId,
    });

    let permission = null;

    try {
        permission = await BackgroundGeolocation.requestPermission();
        console.log("TT_TS_PERMISSION", permission);
    } catch (error) {
        console.log("TT_TS_PERMISSION_ERROR", error);
    }

    const startState = await BackgroundGeolocation.start();

    console.log("TT_TS_START_RESULT", {
        enabled: startState.enabled,
        trackingMode: startState.trackingMode,
    });
    setTimeout(async () => {
        try {
            await BackgroundGeolocation.changePace(true);
            console.log("TT_TS_FORCE_MOVING_OK");
        } catch (e) {
            console.log("TT_TS_FORCE_MOVING_FAIL", e);
        }
    }, 1500);
    // await BackgroundGeolocation.changePace(true);
    // console.log("TT_TS_FORCE_MOVING");

    /*const testLocation = await BackgroundGeolocation.getCurrentPosition({
        samples: 1,
        persist: true,
    });*/

    /*console.log("TT_TS_TEST_LOCATION_PERSISTED", {
        lat: testLocation.coords.latitude,
        lng: testLocation.coords.longitude,
        accuracy: testLocation.coords.accuracy,
    });*/

    // const paceState = await BackgroundGeolocation.changePace(true);

    /*console.log("TT_TS_FORCE_MOVING_RESULT", {
        enabled: paceState?.enabled,
        trackingMode: paceState?.trackingMode,
        authorization: paceState?.authorization,
    });*/


}

export async function stopTripperTrackLocation() {
    try {
      //  await BackgroundGeolocation.stop();

        currentEventId = null;
        currentUserId = null;

        console.log("TT_TS_STOP");
    } catch (error) {
        console.log("TT_TS_STOP_FAIL", error);
    }
}