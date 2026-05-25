import React, { useState, useEffect, useRef } from "react";
import { Modal, Dimensions, Linking } from "react-native";
import { FlashList } from "@shopify/flash-list";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  TextInput,
  Keyboard,
  FlatList,
  ActivityIndicator,
  Image,
} from "react-native";

export default function RadarScreen({
  userLocation,
  onClose,
  onGoToPlace,
  onCreateMeetupFromRadar,
}) {
  const [photoViewerOpen, setPhotoViewerOpen] = useState(false);
  const [viewerPhotos, setViewerPhotos] = useState([]);
  const [viewerStartIndex, setViewerStartIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [radarItems, setRadarItems] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const isFetchingRef = useRef(false);
  const lastFetchKeyRef = useRef("");
  const [eventRange, setEventRange] = useState("today"); // "today" | "week" | "month"
  const [distanceMiles, setDistanceMiles] = useState("10"); // default 10 miles
  const [radarFilters, setRadarFilters] = useState({
    festivals: false,
    music: true,
    theatre: true,
    otherEvents: true,
    explore: true,
    bars: true,
    food: true,
  });
  const isFestivalOnly =
    radarFilters.festivals &&
    !radarFilters.music &&
    !radarFilters.theatre &&
    !radarFilters.otherEvents &&
    !radarFilters.explore &&
    !radarFilters.bars &&
    !radarFilters.food;
  const openPhotoViewer = (photos = [], startIndex = 0) => {
    const cleanPhotos = photos
      .map((p) => p.url || p.photoUrl || p.uri)
      .filter(Boolean);

    if (!cleanPhotos.length) return;

    setViewerPhotos(cleanPhotos);
    setViewerStartIndex(startIndex);
    setPhotoViewerOpen(true);
  };

  const openGooglePlacePhotos = async (item) => {
    try {
      if (!item?.id) {
        openPhotoViewer([{ url: item.imageUrl }], 0);
        return;
      }

      const url =
        `https://maps.googleapis.com/maps/api/place/details/json` +
        `?place_id=${item.id}` +
        `&fields=photos` +
        `&key=AIzaSyBi6B8QBhiDO3Tfs3sO80hn-qpfPJOqZu4`;

      const res = await fetch(url);
      const data = await res.json();

      const googlePhotos =
        data?.result?.photos?.map((p) => ({
          url: `https://maps.googleapis.com/maps/api/place/photo?maxwidth=1400&photo_reference=${p.photo_reference}&key=AIzaSyBi6B8QBhiDO3Tfs3sO80hn-qpfPJOqZu4`,
        })) || [];

      const fallbackPhotos =
        item.photos?.length ? item.photos : item.imageUrl ? [{ url: item.imageUrl }] : [];

      openPhotoViewer(googlePhotos.length ? googlePhotos : fallbackPhotos, 0);
    } catch (err) {
      console.log("TT_RADAR_PLACE_PHOTOS_ERROR", err);
      openPhotoViewer(
        item.photos?.length ? item.photos : item.imageUrl ? [{ url: item.imageUrl }] : [],
        0
      );
    }
  };
  const toggleRadarFilter = (key) => {
    if (key === "festivals") {
      setRadarFilters((prev) => {
        const turningOn = !prev.festivals;

        return {
          festivals: turningOn,
          music: !turningOn,
          theatre: !turningOn,
          otherEvents: !turningOn,
          explore: !turningOn,
          bars: !turningOn,
          food: !turningOn,
        };
      });

      return;
    }

    setRadarFilters((prev) => ({
      ...prev,
      festivals: false,
      [key]: !prev[key],
    }));
  };

  useEffect(() => {
    if (!userLocation?.latitude || !userLocation?.longitude) return;

    const roundedLat = userLocation.latitude.toFixed(2);
    const roundedLng = userLocation.longitude.toFixed(2);
    const query = searchQuery.trim().toLowerCase();

    const filterKey = Object.entries(radarFilters)
      .filter(([, value]) => value)
      .map(([key]) => key)
      .join(",");

    const fetchKey = `${roundedLat}-${roundedLng}-${query}-${eventRange}-${distanceMiles}-${filterKey}`;
    if (lastFetchKeyRef.current === fetchKey) return;
    lastFetchKeyRef.current = fetchKey;

    const timeout = setTimeout(() => {
      fetchNearbyPlaces();
    }, 500);

    return () => clearTimeout(timeout);
  }, [
    userLocation?.latitude?.toFixed?.(2),
    userLocation?.longitude?.toFixed?.(2),
    searchQuery,
    eventRange,
    distanceMiles,
    radarFilters.festivals,
    radarFilters.music,
    radarFilters.theatre,
    radarFilters.otherEvents,
    radarFilters.explore,
    radarFilters.bars,
    radarFilters.food,
  ]);

  function isWithinEventRange(dateString, range) {
    if (!dateString) return false;

    const date = new Date(dateString);
    if (Number.isNaN(date.getTime())) return false;

    const now = new Date();
    const limit = new Date();

    if (range === "today") {
      limit.setHours(23, 59, 59, 999);
    } else if (range === "week") {
      limit.setDate(limit.getDate() + 7);
    } else {
      limit.setMonth(limit.getMonth() + 1);
    }

    return date >= now && date <= limit;
  }

  function isWithinFestivalRange(dateString, range) {
    if (!dateString) return false;

    const date = new Date(dateString);
    if (Number.isNaN(date.getTime())) return false;

    const now = new Date();

    if (range === "today") {
      const end = new Date();
      end.setMonth(end.getMonth() + 1);
      return date >= now && date <= end;
    }

    if (range === "week") {
      const summerStart = new Date(now.getFullYear(), 4, 1); // May 1
      const summerEnd = new Date(now.getFullYear(), 8, 30, 23, 59, 59); // Sep 30
      return date >= summerStart && date <= summerEnd;
    }

    const yearEnd = new Date(now.getFullYear(), 11, 31, 23, 59, 59);
    return date >= now && date <= yearEnd;
  }

  function getEventGroup(event) {
    const text = `${event.title || ""} ${event.venue || ""} ${event.classification || ""}`.toLowerCase();

    if (
      text.includes("comedy") ||
      text.includes("comedian") ||
      text.includes("stand up") ||
      text.includes("stand-up") ||
      text.includes("theatre") ||
      text.includes("theater") ||
      text.includes("musical") ||
      text.includes("play") ||
      text.includes("opera") ||
      text.includes("ballet")
    ) {
      return "theatreComedy";
    }

    if (
      text.includes("music") ||
      text.includes("club") ||
      text.includes("dj") ||
      text.includes("rave") ||
      text.includes("drum") ||
      text.includes("bass") ||
      text.includes("dnb") ||
      text.includes("garage") ||
      text.includes("house") ||
      text.includes("techno") ||
      text.includes("festival") ||
      text.includes("concert") ||
      text.includes("live")
    ) {
      return "musicNightlife";
    }

    return "other";
  }

  function isExploreEvent(event) {
    const text = `${event.title || ""} ${event.venue || ""}`.toLowerCase();

    return (
      text.includes("tour") ||
      text.includes("tours") ||
      text.includes("museum") ||
      text.includes("sea life") ||
      text.includes("madame tussauds") ||
      text.includes("hop on") ||
      text.includes("hop-on") ||
      text.includes("bus tour") ||
      text.includes("sightseeing") ||
      text.includes("theatre tour") ||
      text.includes("experience") ||
      text.includes("attraction") ||
      text.includes("dungeon") ||
      text.includes("london dungeon") ||
      text.includes("walking tour") ||
      text.includes("river cruise") ||
      text.includes("cruise") ||
      text.includes("shrek")
    );
  }

  async function fetchNearbyPlaces() {
    if (isFetchingRef.current) return;

    isFetchingRef.current = true;
    setIsLoading(true);

    try {
      const lat = userLocation.latitude;
      const lng = userLocation.longitude;
      const radius = Math.min(
        Math.round((Number(distanceMiles) || 10) * 1609.34),
        50000
      );
      const query = searchQuery.trim().toLowerCase();
      if (radarFilters.festivals) {
        const festivalEvents = await fetchSkiddleFestivals(query);

        setRadarItems([
          { id: "section-festivals", type: "section", title: "🎪 Upcoming Festivals" },
          ...festivalEvents,
        ]);

        return;
      }
      const types = searchQuery.trim()
        ? ["keyword"]
        : ["bar", "night_club", "restaurant", "cafe", "meal_takeaway"];

      const allResults = [];
      const keyword = isFestivalOnly ? "" : searchQuery?.trim();

      for (const type of types) {
        const url = `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${lat},${lng}&radius=${radius}${keyword
          ? `&keyword=${encodeURIComponent(keyword)}`
          : `&type=${type}&opennow=true`
          }&key=AIzaSyBi6B8QBhiDO3Tfs3sO80hn-qpfPJOqZu4`;
        const res = await fetch(url);
        const data = await res.json();


        const results = (data.results || [])
          .map((place) => {
            const distance = getDistanceMeters(userLocation, {
              latitude: place.geometry.location.lat,
              longitude: place.geometry.location.lng,
            });

            const photoRef = place.photos?.[0]?.photo_reference;
            const photos =
              place.photos?.map((p) => ({
                url: `https://maps.googleapis.com/maps/api/place/photo?maxwidth=1200&photo_reference=${p.photo_reference}&key=AIzaSyBi6B8QBhiDO3Tfs3sO80hn-qpfPJOqZu4`,
              })) || [];
            return {
              id: place.place_id,
              emoji: getPlaceEmoji(place),
              type: "now",
              category: type,
              googleTypes: place.types || [],
              title: place.name,
              venue: place.vicinity,
              status: place.opening_hours?.open_now ? "Open now" : "Closed",

              imageUrl: photoRef
                ? `https://maps.googleapis.com/maps/api/place/photo?maxwidth=400&photo_reference=${photoRef}&key=AIzaSyBi6B8QBhiDO3Tfs3sO80hn-qpfPJOqZu4`
                : null,
              photos,
              distanceText:
                distance == null
                  ? "Distance unknown"
                  : distance < 1000
                    ? `${distance}m`
                    : `${(distance / 1609.344).toFixed(1)}miles`,

              latitude: place.geometry.location.lat,
              longitude: place.geometry.location.lng,
            };
          });

        allResults.push(...results.filter(Boolean));
      }

      // remove duplicates (important)
      const unique = Array.from(
        new Map(allResults.map((item) => [item.id, item])).values()
      );

      // sort nearest first
      unique.sort((a, b) => {
        const da = getDistanceMeters(userLocation, {
          latitude: a.latitude,
          longitude: a.longitude,
        });

        const db = getDistanceMeters(userLocation, {
          latitude: b.latitude,
          longitude: b.longitude,
        });

        return da - db;
      });

      const hasSearch = !!searchQuery.trim();

      if (hasSearch) {
        setRadarItems([
          {
            id: "section-search",
            type: "section",
            title: `🔎 Search results for "${searchQuery.trim()}"`,
          },
          ...unique.slice(0, 30),
        ]);

        return;
      }

      const skiddleEvents = await fetchSkiddleEvents();
      const ticketmasterEvents = await fetchTicketmasterEvents();

      const events = [...ticketmasterEvents, ...skiddleEvents].sort((a, b) => {
        const da = getItemDistanceMeters(a);
        const db = getItemDistanceMeters(b);

        if (da == null && db == null) return 0;
        if (da == null) return 1;
        if (db == null) return -1;

        return da - db;
      });

      const exploreEvents = events.filter(isExploreEvent);

      const nonExploreEvents = events.filter((item) => !isExploreEvent(item));

      const musicNightlifeEvents = nonExploreEvents.filter(
        (item) => getEventGroup(item) === "musicNightlife"
      );

      const theatreComedyEvents = nonExploreEvents.filter(
        (item) => getEventGroup(item) === "theatreComedy"
      );

      const otherEvents = nonExploreEvents.filter(
        (item) => getEventGroup(item) === "other"
      );

      const nightlifePlaces = unique.filter((item) =>
        item.category === "night_club"
      );

      const barsAndPubs = unique.filter((item) =>
        item.category === "bar"
      );

      const foodPlaces = unique.filter((item) =>
        item.category === "restaurant" ||
        item.category === "cafe" ||
        item.category === "meal_takeaway" ||
        item.googleTypes?.includes("restaurant") ||
        item.googleTypes?.includes("cafe") ||
        item.googleTypes?.includes("meal_takeaway")
      );

      const filteredItems = [];

      if (radarFilters.music) {
        filteredItems.push(
          { id: "section-music", type: "section", title: "🎧 Music & Nightlife" },
          ...musicNightlifeEvents
        );
      }

      if (radarFilters.theatre) {
        filteredItems.push(
          { id: "section-theatre", type: "section", title: "🎭 Theatre & Comedy" },
          ...theatreComedyEvents
        );
      }

      if (radarFilters.otherEvents) {
        filteredItems.push(
          { id: "section-other-events", type: "section", title: "🎟️ Other Events" },
          ...otherEvents
        );
      }

      if (radarFilters.explore) {
        filteredItems.push(
          { id: "section-explore", type: "section", title: "🌞 Explore Nearby" },
          ...exploreEvents
        );
      }

      if (radarFilters.bars) {
        filteredItems.push(
          { id: "section-bars", type: "section", title: "🍺 Bars & Pubs" },
          ...barsAndPubs.slice(0, 10)
        );
      }

      if (radarFilters.food) {
        filteredItems.push(
          { id: "section-food", type: "section", title: "🍔 Food & Eats" },
          ...foodPlaces.slice(0, 12)
        );
      }

      setRadarItems(filteredItems);

    } catch (err) {
      console.log("Radar fetch error:", err);
    } finally {
      isFetchingRef.current = false;
      setIsLoading(false);
    }
  }

  function getTicketmasterDateWindow(range) {
    const start = new Date();
    const end = new Date();

    if (range === "today") {
      end.setHours(23, 59, 59, 999);
    } else if (range === "week") {
      end.setDate(end.getDate() + 7);
    } else {
      end.setMonth(end.getMonth() + 1);
    }

    return {
      minDate: start.toISOString().replace(/\.\d{3}Z$/, "Z"),
      maxDate: end.toISOString().replace(/\.\d{3}Z$/, "Z"),
    };
  }

  async function fetchTicketmasterEvents() {
    try {
      const lat = userLocation.latitude;
      const lng = userLocation.longitude;

      const { minDate, maxDate } = getTicketmasterDateWindow(eventRange);

      const url =
        `https://app.ticketmaster.com/discovery/v2/events.json` +
        `?apikey=B9yfSLKZfj4lU0P38GaPz5VlliY7sUvl` +
        `&latlong=${lat},${lng}` +
        `&radius=${Number(distanceMiles) || 10}` +
        `&unit=miles` +
        `&startDateTime=${minDate}` +
        `&endDateTime=${maxDate}` +
        `&sort=date,asc` +
        `&size=50`;

      const res = await fetch(url);
      const data = await res.json();

      const events = data?._embedded?.events || [];

      return events
        .map((event) => {
          const venue = event?._embedded?.venues?.[0];
          const image =
            event.images?.find((img) => img.ratio === "16_9" && !img.fallback) ||
            event.images?.[0];
          const photos =
            event.images?.map((img) => ({
              url: img.url,
            })) || [];

          const latitude = parseFloat(venue?.location?.latitude);
          const longitude = parseFloat(venue?.location?.longitude);

          return {
            id: `ticketmaster-${event.id}`,
            emoji: "🎟️",
            type: "event",
            source: "Ticketmaster",
            photos,
            title: event.name || "Ticketmaster event",
            startDateTime:
              event.dates?.start?.dateTime ||
              event.dates?.start?.localDate ||
              null,
            venue: venue?.name || venue?.city?.name || "Venue TBA",
            classification:
              event.classifications?.[0]?.segment?.name ||
              event.classifications?.[0]?.genre?.name ||
              event.classifications?.[0]?.subGenre?.name ||
              "",
            status: formatEventDateTime(
              event.dates?.start?.dateTime ||
              event.dates?.start?.localDate

            ),
            distanceText: venue?.distance
              ? `${Number(venue.distance).toFixed(1)} miles`
              : "",
            latitude,
            longitude,
            imageUrl: image?.url || null,
            url: event.url || null,
          };
        })
        .filter(
          (event) =>
            Number.isFinite(event.latitude) &&
            Number.isFinite(event.longitude)
        );
    } catch (err) {
      console.log("Ticketmaster error:", err);
      return [];
    }
  }

  function getSkiddleDateWindow(range) {
    const start = new Date();
    const end = new Date();

    if (range === "today") {
      end.setHours(23, 59, 59, 999);
    } else if (range === "week") {
      end.setDate(end.getDate() + 7);
    } else {
      end.setMonth(end.getMonth() + 1);
    }

    const format = (date) => date.toISOString().slice(0, 10);

    return {
      minDate: format(start),
      maxDate: format(end),
    };
  }

  function getEventUrl(item) {
    if (!item) return null;

    if (typeof item.url !== "string" || !item.url.startsWith("http")) {
      return null;
    }

    if (item.source === "Skiddle") {
      return addSkiddleAffiliateTag(item.url);
    }

    return item.url;
  }

  function addSkiddleAffiliateTag(url) {
    if (typeof url !== "string" || !url.startsWith("http")) return null;

    if (!url.includes("skiddle.com")) return url;

    if (url.includes("sktag=")) return url;

    const separator = url.includes("?") ? "&" : "?";

    return `${url}${separator}sktag=15691`;
  }

  function getFestivalDateWindow(range) {
    const now = new Date();
    const start = new Date();
    const end = new Date();

    if (range === "today") {
      // Next 1 month
      end.setMonth(end.getMonth() + 1);
    } else if (range === "week") {
      // Summer season
      start.setMonth(4, 1); // May 1
      start.setHours(0, 0, 0, 0);

      end.setMonth(8, 30); // Sep 30
      end.setHours(23, 59, 59, 999);
    } else {
      // All current year
      end.setMonth(11, 31); // Dec 31
      end.setHours(23, 59, 59, 999);
    }

    const format = (date) => date.toISOString().slice(0, 10);

    return {
      minDate: format(start),
      maxDate: format(end),
    };
  }
  function isUkFestival(event) {
    const text = `
    ${event.venue?.country || ""}
    ${event.venue?.countryCode || ""}
    ${event.venue?.country_code || ""}
    ${event.venue?.address || ""}
    ${event.venue?.city || ""}
    ${event.venue?.town || ""}
  `.toLowerCase();

    return (
      text.includes("united kingdom") ||
      text.includes("uk") ||
      text.includes("gb") ||
      text.includes("england") ||
      text.includes("scotland") ||
      text.includes("wales") ||
      text.includes("northern ireland")
    );
  }

  async function fetchSkiddleFestivals(query = "") {
    try {

      const now = new Date();
      let year = now.getFullYear();

      const festivalMonths =
        eventRange === "today"
          ? [0, 1, 2, 3]
          : eventRange === "week"
            ? [4, 5, 6, 7]
            : [8, 9, 10, 11];

      // If this festival season block has already passed,
      // search next year's block instead.
      const blockEnd = new Date(year, festivalMonths[festivalMonths.length - 1] + 1, 0);
      blockEnd.setHours(23, 59, 59, 999);

      if (blockEnd < now) {
        year += 1;
      }

      const allResults = [];

      for (const monthIndex of festivalMonths) {
        const start = new Date(year, monthIndex, 1);
        const end = new Date(year, monthIndex + 1, 0);

        if (end < now) continue;

        const minDate = start.toISOString().slice(0, 10);
        const maxDate = end.toISOString().slice(0, 10);

        const res = await fetch(
          `https://www.skiddle.com/api/v1/events/search/?api_key=888f31679b7051dcc6284fba69315139&latitude=${userLocation.latitude}&longitude=${userLocation.longitude}&radius=${Number(distanceMiles) || 100}&order=date&description=1&getdistance=1&ticketlink=1&eventcode=FEST&minDate=${minDate}&maxDate=${maxDate}&limit=100`
        );

        const data = await res.json();

        allResults.push(...(data.results || []));
      }

      const unique = Array.from(
        new Map(allResults.map((event) => [event.id, event])).values()
      );

      return unique
        .filter(isUkFestival)
        .filter((event) => {
          if (!query) return true;

          const artists =
            event.artists?.map((a) => a.name || a.artistname || a).join(" ") || "";

          const text = `
           ${event.eventname || ""}
           ${event.name || ""}
           ${event.title || ""}
           ${event.venue?.name || ""}
           ${event.venue?.city || ""}
           ${event.venue?.town || ""}
           ${event.venue?.address || ""}
           ${event.description || ""}
           ${event.genres?.map((g) => g.name).join(" ") || ""}
           ${artists}
           festival festivals music festival
         `.toLowerCase();

          return text.includes(query);
        })
        .filter((event) => {
          const eventDate = new Date(event.startdate || event.date);
          if (Number.isNaN(eventDate.getTime())) return false;

          const todayStart = new Date();
          todayStart.setHours(0, 0, 0, 0);

          return eventDate >= todayStart;
        })
        .sort((a, b) => {
          const da = new Date(a.startdate || a.date).getTime();
          const db = new Date(b.startdate || b.date).getTime();
          return da - db;
        })
        .map((event) => ({
          id: `skiddle-festival-${event.id}`,
          emoji: "🎪",
          type: "event",
          source: "Skiddle",
          url:
            typeof event.link === "string" && event.link.startsWith("http")
              ? event.link
              : typeof event.ticketlink === "string" &&
                event.ticketlink.startsWith("http")
                ? event.ticketlink
                : null,
          startDateTime: event.startdate || event.date || null,
          title: event.eventname || "Festival",
          venue: event.venue?.name || event.venue?.address || "Venue TBA",
          status: formatEventDateTime(event.startdate || event.date),
          distanceText: [
            event.distance ? `${Number(event.distance).toFixed(1)} miles` : null,
            event.venue?.city || event.venue?.town || event.venue?.address || null,
          ]
            .filter(Boolean)
            .join(" · "),
          latitude: parseFloat(event.venue?.latitude),
          longitude: parseFloat(event.venue?.longitude),
          imageUrl:
            event.largeimageurl ||
            event.xlargeimageurl ||
            event.imageurl ||
            null,
          photos: [
            {
              url:
                event.largeimageurl ||
                event.xlargeimageurl ||
                event.imageurl ||
                null,
            },
          ].filter((p) => p.url),
          classification: "Festival",
        }))
        .filter(
          (event) =>
            Number.isFinite(event.latitude) &&
            Number.isFinite(event.longitude)
        );
    } catch (err) {
      console.log("Skiddle festivals error:", err);
      return [];
    }
  }

  async function fetchSkiddleEvents() {
    try {
      const lat = userLocation.latitude;
      const lng = userLocation.longitude;


      const res = await fetch(
        `https://www.skiddle.com/api/v1/events/search/?api_key=888f31679b7051dcc6284fba69315139&latitude=${lat}&longitude=${lng}&radius=${Number(distanceMiles) || 10}&order=date&description=1&getdistance=1&ticketlink=1&limit=200`
      );

      const data = await res.json();

      const events = (data.results || [])
        .filter((event) => isWithinEventRange(event.startdate || event.date, eventRange))
        .filter((event) => {
          const miles = parseFloat(event.distance);
          return !distanceMiles || !Number.isFinite(miles) || miles <= Number(distanceMiles);
        })
        .slice(0, 50)
        .map((event) => ({
          id: `skiddle-${event.id}`,
          emoji: "🎟️",
          type: "event",
          source: "Skiddle",

          url:
            typeof event.link === "string" && event.link.startsWith("http")
              ? event.link
              : typeof event.ticketlink === "string" && event.ticketlink.startsWith("http")
                ? event.ticketlink
                : null,
          startDateTime: event.startdate || event.date || null,
          title: event.eventname || "Event",
          venue: event.venue?.name || event.venue?.address || "Venue TBA",
          status: formatEventDateTime(event.startdate || event.date),
          distanceText: (() => {
            const venueLat = parseFloat(event.venue?.latitude);
            const venueLng = parseFloat(event.venue?.longitude);

            const meters = getDistanceMeters(userLocation, {
              latitude: venueLat,
              longitude: venueLng,
            });

            if (meters == null || !Number.isFinite(meters)) return "";

            const miles = metersToMiles(meters);

            return `${miles.toFixed(1)} miles`;
          })(),
          latitude: parseFloat(event.venue?.latitude),
          longitude: parseFloat(event.venue?.longitude),
          imageUrl:
            event.largeimageurl ||
            event.xlargeimageurl ||
            event.imageurl ||
            null,
          classification: event.genres?.map((g) => g.name).join(" ") || "",
        }))
        .filter((event) =>
          Number.isFinite(event.latitude) &&
          Number.isFinite(event.longitude)
        );

      
      return events;
    } catch (err) {
      console.log("Skiddle error:", err);
      return [];
    }
  }

  function getPlaceEmoji(place) {
    const types = place.types || [];

    if (types.includes("bar") || types.includes("night_club")) return "🍺";
    if (types.includes("restaurant") || types.includes("meal_takeaway")) return "🍔";
    if (types.includes("cafe")) return "☕";
    if (types.includes("store") || types.includes("shopping_mall")) return "🛍️";
    if (types.includes("supermarket")) return "🛒";
    if (types.includes("pharmacy")) return "💊";
    if (types.includes("gas_station")) return "⛽";
    if (types.includes("park")) return "🌳";

    return "📍"; // fallback
  }
  return (
    <SafeAreaView style={styles.overlay}>
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <View style={styles.titleDistanceRow}>
            <Text style={styles.title}>Radar</Text>

            <View style={styles.distanceRow}>
              <Text style={styles.distanceLabel}>Miles:</Text>

              <TextInput
                value={distanceMiles}
                onChangeText={setDistanceMiles}
                keyboardType="numeric"
                style={styles.distanceInput}
                placeholder="10"
                placeholderTextColor="#64748b"
              />
            </View>
          </View>
        </View>

        <TouchableOpacity onPress={onClose} style={styles.closeButton}>
          <Text style={styles.closeText}>✕</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.searchWrap}>
        <View style={styles.searchInputRow}>
          <TextInput
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder={
              radarFilters.festivals
                ? "Search festivals, artists, cities..."
                : "Search ATM, food, shops..."
            }
            placeholderTextColor="#64748b"
            style={styles.radarSearchInput}
            returnKeyType="search"
            blurOnSubmit={true}
            onSubmitEditing={() => Keyboard.dismiss()}
          />

          {!!searchQuery.trim() && (
            <TouchableOpacity
              style={styles.clearSearchButton}
              onPress={() => {
                setSearchQuery("");
                Keyboard.dismiss();
              }}
            >
              <Text style={styles.clearSearchText}>✕</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      <View style={styles.rangeRow}>
        {[
          radarFilters.festivals
            ? ["today", "Jan-Apr"]
            : ["today", "Today"],

          radarFilters.festivals
            ? ["week", "May-Aug"]
            : ["week", "This week"],

          radarFilters.festivals
            ? ["month", "Sep-Dec"]
            : ["month", "This month"],
        ]

          .map(([value, label]) => (
            <TouchableOpacity
              key={value}
              style={[
                styles.rangeChip,
                eventRange === value && styles.rangeChipActive,
              ]}
              onPress={() => setEventRange(value)}
            >
              <Text
                style={[
                  styles.rangeChipText,
                  eventRange === value && styles.rangeChipTextActive,
                ]}
              >
                {label}
              </Text>
            </TouchableOpacity>
          ))}
      </View>

      <View style={styles.filterRow}>
        {[
          ["festivals", "🎪"],
          ["music", "🎧"],
          ["theatre", "🎭"],
          ["otherEvents", "🎟️"],
          ["explore", "🌞"],
          ["bars", "🍺"],
          ["food", "🍔"],
        ].map(([key, label]) => (
          <TouchableOpacity
            key={key}
            style={[
              styles.filterChip,
              radarFilters[key] && styles.filterChipActive,
            ]}
            onPress={() => toggleRadarFilter(key)}
          >
            <Text
              style={[
                styles.filterChipText,
                radarFilters[key] && styles.filterChipTextActive,
              ]}
            >
              {label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <FlashList
        style={{ flex: 1 }}
        data={radarItems}
        estimatedItemSize={88}
        drawDistance={500}
        keyExtractor={(item, index) => `${item.type}-${item.id}-${index}`}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.content}
        //showsVerticalScrollIndicator={true}
        // persistentScrollbar={true}

        ListHeaderComponent={null}

        ListEmptyComponent={
          isLoading ? (
            <ActivityIndicator style={{ marginTop: 30 }} />
          ) : (
            <Text style={styles.emptyNote}>
              No radar results yet.
            </Text>
          )
        }
        renderItem={({ item }) => {
          if (item.type === "section") {
            return <Text style={styles.sectionTitle}>{item.title}</Text>;
          }

          return (
            <RadarCard
              item={item}
              onGoToPlace={onGoToPlace}
              onCreateMeetupFromRadar={onCreateMeetupFromRadar}
            />
          );
        }}
      />
      <Modal
        visible={photoViewerOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setPhotoViewerOpen(false)}
      >
        <View style={styles.photoViewerOverlay}>
          <TouchableOpacity
            style={styles.photoViewerClose}
            onPress={() => setPhotoViewerOpen(false)}
          >
            <Text style={styles.photoViewerCloseText}>✕</Text>
          </TouchableOpacity>

          <FlatList
            data={viewerPhotos}
            horizontal
            pagingEnabled
            initialScrollIndex={viewerStartIndex}
            getItemLayout={(_, index) => ({
              length: Dimensions.get("window").width,
              offset: Dimensions.get("window").width * index,
              index,
            })}
            keyExtractor={(item, index) => `${item}-${index}`}
            renderItem={({ item }) => (
              <View style={styles.photoViewerSlide}>
                <Image
                  source={{ uri: item }}
                  style={styles.photoViewerImage}
                  resizeMode="contain"
                />
              </View>
            )}
          />
        </View>
      </Modal>
    </SafeAreaView>
  );

  function formatEventDateTime(dateString) {
    if (!dateString) return "Date TBA";

    const date = new Date(dateString);
    if (Number.isNaN(date.getTime())) return "Date TBA";

    return date.toLocaleString([], {
      weekday: "short",
      day: "numeric",
      month: "short",
      hour: "numeric",
      minute: "2-digit",
    });
  }

  function metersToMiles(m) {
    return m == null ? null : m * 0.000621371;
  }

  function getItemDistanceMeters(item) {
    return getDistanceMeters(userLocation, {
      latitude: item.latitude,
      longitude: item.longitude,
    });
  }

  function getDistanceMeters(from, to) {
    if (!from || !to) return null;

    const toRad = (v) => (v * Math.PI) / 180;
    const R = 6371000;

    const dLat = toRad(to.latitude - from.latitude);
    const dLon = toRad(to.longitude - from.longitude);

    const lat1 = toRad(from.latitude);
    const lat2 = toRad(to.latitude);

    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(lat1) *
      Math.cos(lat2) *
      Math.sin(dLon / 2) ** 2;

    return Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
  }

  function RadarCard({ item, onGoToPlace, onCreateMeetupFromRadar }) {
    const ticketUrl = getEventUrl(item);

    return (
      <View style={styles.card}>
        <View style={styles.iconBox}>
          {item.imageUrl ? (
            <TouchableOpacity
              style={styles.cardImageTap}
              activeOpacity={0.85}
              onPress={() => {
                if (item.source === "Ticketmaster" || item.source === "Skiddle") {
                  openPhotoViewer(item.photos || [{ url: item.imageUrl }], 0);
                } else {
                  openGooglePlacePhotos(item);
                }
              }}
            >
              <Image
                source={{ uri: item.imageUrl }}
                style={styles.cardImage}
                resizeMode="cover"
                fadeDuration={0}

              />
            </TouchableOpacity>
          ) : (
            <Text style={styles.icon}>{item.emoji}</Text>
          )}
        </View>

        <View style={styles.cardBody}>
          <Text style={styles.cardTitle} numberOfLines={1}>
            {item.title}
          </Text>

          <Text style={styles.cardVenue} numberOfLines={1}>
            {item.venue}
          </Text>

          <View style={styles.metaBlock}>
            {!!item.status && (
              <Text style={styles.cardMeta} numberOfLines={1}>
                {item.status}
              </Text>
            )}

            {!!item.distanceText && (
              <Text style={styles.cardMeta} numberOfLines={1}>
                {item.distanceText}
              </Text>
            )}

            {!!item.source && (
              <Text style={styles.cardMeta} numberOfLines={1}>
                {item.source}
              </Text>
            )}
          </View>
        </View>

        <View style={styles.radarCardButtons}>
          <TouchableOpacity
            style={styles.goButton}
            onPress={() => onGoToPlace?.(item)}
          >
            <Text style={styles.goButtonText}>Go</Text>
          </TouchableOpacity>

          {!item.id?.startsWith("no-skiddle") && (
            <TouchableOpacity
              style={styles.meetButton}
              onPress={() => {
                console.log("TT_RADAR_MEET_PRESS", item);
                onCreateMeetupFromRadar?.(item);
              }}
            >
              <Text style={styles.meetButtonText}>Meet</Text>
            </TouchableOpacity>
          )}
          {!!ticketUrl && (
            <TouchableOpacity
              style={styles.ticketButton}
              onPress={() => Linking.openURL(ticketUrl)}
            >
              <Text style={styles.ticketButtonText}>Tickets</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  }

}

const styles = StyleSheet.create({

  overlay: {
    flex: 1,
    backgroundColor: "#000000",
  },

  header: {
    paddingHorizontal: 18,
    paddingTop: 0,
    paddingBottom: 0,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(9, 8, 9, 0.35)",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },

  title: {
    color: "#fff",
    fontSize: 26,
    fontWeight: "800",
  },

  subtitle: {
    color: "#c4b5fd",
    fontSize: 13,
    marginTop: 2,
  },

  closeButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "rgba(15,23,42,0.95)",
    borderWidth: 1,
    borderColor: "#403748",
    alignItems: "center",
    justifyContent: "center",
  },

  closeText: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "800",
  },

  content: {
    paddingHorizontal: 0,
    paddingTop: 16,
    paddingBottom: 40,
  },

  sectionTitle: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "800",
    marginTop: 14,
    marginBottom: 10,
  },

  card: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(0, 0, 0, 0.96)",
    borderWidth: 1,
    borderColor: "rgba(0, 0, 0, 0.35)",
    borderRadius: 18,
    paddingVertical: 12,
    paddingLeft: 0,
    paddingRight: 0,
    marginBottom: 6,
    Height: 82,
  },

  iconBox: {
    width: 70,
    height: 70,
    borderRadius: 6,
    backgroundColor: "rgba(168,85,247,0.18)",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 6,
  },

  icon: {
    fontSize: 24,
  },

  cardBody: {
    flex: 1,
  },

  cardTitle: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "800",
  },

  cardVenue: {
    color: "#c4b5fd",
    fontSize: 13,
    marginTop: 2,
  },

  cardMeta: {
    color: "#94a3b8",
    fontSize: 15,
    marginTop: 3,
  },

  goButton: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: "#26611aba",
  },

  goButtonText: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "800",
  },

  emptyNote: {
    color: "#64748b",
    fontSize: 12,
    textAlign: "center",
    marginTop: 24,
  },

  searchWrap: {
    paddingHorizontal: 16,
    paddingTop: 4,
    paddingBottom: 6,
  },

  radarSearchInput: {
    backgroundColor: "rgba(15,23,42,0.96)",
    borderWidth: 1,
    borderColor: "rgba(4, 3, 4, 0.35)",
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: "#fff",
    fontSize: 15,
  },
  rangeRow: {
    flexDirection: "row",
    gap: 10,
    paddingHorizontal: 16,
    paddingBottom: 8,
  },

  rangeChip: {
    flex: 1,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(0, 0, 0, 0.35)",
    paddingVertical: 9,
    alignItems: "center",
    backgroundColor: "rgba(15,23,42,0.96)",
  },

  rangeChipActive: {
    backgroundColor: "#5568f7a1",
  },

  rangeChipText: {
    color: "#edebf5",
    fontSize: 12,
    fontWeight: "800",
  },

  rangeChipTextActive: {
    color: "#fff",
  },

  distanceRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 6,
  },

  distanceLabel: {
    color: "#e3e3e3",
    fontSize: 12,
    marginRight: 6,
  },

  distanceInput: {
    borderWidth: 1,
    borderColor: "rgb(0, 0, 0)",
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    color: "#fff",
    fontSize: 12,
    width: 50,
    textAlign: "center",
    backgroundColor: "rgba(15,23,42,0.96)",
  },

  titleDistanceRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  cardImage: {
    width: "100%",
    height: "100%",
    borderRadius: 14,
  },

  searchInputRow: {
    position: "relative",
    justifyContent: "center",
  },

  clearSearchButton: {
    position: "absolute",
    right: 12,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "rgba(168,85,247,0.22)",
    alignItems: "center",
    justifyContent: "center",
  },

  clearSearchText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "800",
  },

  radarCardButtons: {
    alignItems: "center",
    gap: 3,
  },

  meetButton: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: "#facc15e7",
  },

  meetButtonText: {
    color: "#1A1405",
    fontSize: 13,
    fontWeight: "800",
  },

  photoViewerOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.96)",
    justifyContent: "center",
    alignItems: "center",
  },

  photoViewerClose: {
    position: "absolute",
    top: 50,
    right: 22,
    zIndex: 20,
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: "rgba(255,255,255,0.14)",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.25)",
  },

  photoViewerCloseText: {
    color: "#fff",
    fontSize: 24,
    fontWeight: "800",
  },

  photoViewerSlide: {
    width: Dimensions.get("window").width,
    height: Dimensions.get("window").height,
    justifyContent: "center",
    alignItems: "center",
  },

  photoViewerImage: {
    width: Dimensions.get("window").width,
    height: Dimensions.get("window").height * 0.82,
  },

  cardImageTap: {
    width: "100%",
    height: "100%",
    borderRadius: 14,
  },
  filterRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 16,
    paddingHorizontal: 16,
    paddingBottom: 0,
  },

  filterChip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(4, 4, 4, 0.35)",
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: "rgba(15,23,42,0.96)",
  },

  filterChipActive: {
    backgroundColor: "#5568f7a1",
    borderColor: "#000000",
  },

  filterChipText: {
    color: "#286bc9",
    fontSize: 15,
    fontWeight: "800",
  },

  filterChipTextActive: {
    color: "#fff",
  },

  ticketButton: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: "#bb1b1bc4",
  },

  ticketButtonText: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "800",
  },

  metaBlock: {
    marginTop: 3,
    gap: 1,
  },
});