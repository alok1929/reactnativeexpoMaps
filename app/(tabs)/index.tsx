import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, ScrollView } from 'react-native';
import MapView, { Marker, Polyline } from 'react-native-maps';
import * as Location from 'expo-location';
import { Searchbar, Button } from 'react-native-paper';

const GOOGLE_MAPS_API_KEY = 'AIzaSyD6plhdVFAh45BRfG9QqVVhZuTyNTroGOI';

export default function App() {
  const [location, setLocation] = useState(null);
  const [destination, setDestination] = useState(null);
  const [placeName, setPlaceName] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [errorMsg, setErrorMsg] = useState(null);
  const [distance, setDistance] = useState(null);
  const [duration, setDuration] = useState(null);
  const [polylineCoords, setPolylineCoords] = useState([]);
  const [instructions, setInstructions] = useState([]);

  useEffect(() => {
    (async () => {
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setErrorMsg('Permission to access location was denied');
        return;
      }

      let { coords } = await Location.getCurrentPositionAsync({});
      setLocation({
        latitude: coords.latitude,
        longitude: coords.longitude,
        latitudeDelta: 0.05,
        longitudeDelta: 0.05,
      });
    })();
  }, []);

  const fetchPlaceDetails = async (description) => {
    try {
      const apiUrl = `https://maps.googleapis.com/maps/api/place/findplacefromtext/json?input=${description}&inputtype=textquery&fields=name,geometry&key=${GOOGLE_MAPS_API_KEY}`;
      const response = await fetch(apiUrl);
      const data = await response.json();

      if (data.status === 'OK' && data.candidates.length > 0) {
        const place = data.candidates[0];
        const destinationCoords = {
          latitude: place.geometry.location.lat,
          longitude: place.geometry.location.lng,
        };
        setDestination(destinationCoords);
        setPlaceName(place.name);
        setSearchResults([]);
        fetchRoute(location, destinationCoords);
      } else {
        setErrorMsg('Unable to fetch place information');
      }
    } catch (error) {
      console.error('Error fetching place details:', error);
      setErrorMsg('Error fetching place details');
    }
  };

  const fetchRoute = async (origin, destination) => {
    try {
      const originStr = `${origin.latitude},${origin.longitude}`;
      const destinationStr = `${destination.latitude},${destination.longitude}`;
      const apiUrl = `https://maps.googleapis.com/maps/api/directions/json?origin=${originStr}&destination=${destinationStr}&key=${GOOGLE_MAPS_API_KEY}`;
      const response = await fetch(apiUrl);
      const data = await response.json();

      if (data.status === 'OK' && data.routes.length > 0) {
        const route = data.routes[0].legs[0];
        setDistance(route.distance.text);
        setDuration(route.duration.text);

        // Extract turn-by-turn instructions
        const steps = route.steps.map((step) => ({
          instruction: step.html_instructions.replace(/<[^>]+>/g, ''),
          distance: step.distance.text,
          maneuver: step.maneuver,
        }));
        setInstructions(steps);

        // Extract polyline coordinates
        const polylinePoints = data.routes[0].overview_polyline.points;
        const decodedPolyline = decodePolyline(polylinePoints);
        setPolylineCoords(decodedPolyline);
      } else {
        setErrorMsg('Unable to fetch route information');
      }
    } catch (error) {
      console.error('Error fetching route:', error);
      setErrorMsg('Error fetching route information');
    }
  };

  const fetchSearchResults = async (query) => {
    try {
      const apiUrl = `https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${query}&key=${GOOGLE_MAPS_API_KEY}`;
      const response = await fetch(apiUrl);
      const data = await response.json();

      if (data.status === 'OK') {
        setSearchResults(data.predictions);
      } else {
        setErrorMsg('Unable to fetch search results');
      }
    } catch (error) {
      console.error('Error fetching search results:', error);
      setErrorMsg('Error fetching search results');
    }
  };

  const decodePolyline = (encoded) => {
    let points = [];
    let index = 0;
    let lat = 0;
    let lng = 0;

    while (index < encoded.length) {
      let b;
      let shift = 0;
      let result = 0;
      do {
        b = encoded.charCodeAt(index++) - 63;
        result |= (b & 0x1f) << shift;
        shift += 5;
      } while (b >= 0x20);
      const dlat = (result & 1) !== 0 ? ~(result >> 1) : result >> 1;
      lat += dlat;

      shift = 0;
      result = 0;
      do {
        b = encoded.charCodeAt(index++) - 63;
        result |= (b & 0x1f) << shift;
        shift += 5;
      } while (b >= 0x20);
      const dlng = (result & 1) !== 0 ? ~(result >> 1) : result >> 1;
      lng += dlng;

      points.push({ latitude: lat / 1e5, longitude: lng / 1e5 });
    }
    return points;
  };

  const handleSearch = (query) => {
    setSearchQuery(query);
    if (query) {
      fetchSearchResults(query);
    } else {
      setSearchResults([]);
    }
  };

  const handleResultPress = (description) => {
    fetchPlaceDetails(description);
  };

  return (
    <View style={styles.container}>
      <MapView style={styles.map} initialRegion={location}>
        {location && <Marker coordinate={location} title="Current Location" />}
        {destination && <Marker coordinate={destination} title={placeName} />}
        {polylineCoords.length > 0 && (
          <Polyline
            coordinates={polylineCoords}
            strokeWidth={5}
            strokeColor="hotpink"
          />
        )}
      </MapView>

      <View style={styles.searchContainer}>
        <Searchbar
          placeholder="Search for a place"
          value={searchQuery}
          onChangeText={handleSearch}
          style={styles.searchBar}
        />
        <FlatList
          data={searchResults}
          keyExtractor={(item) => item.place_id}
          renderItem={({ item }) => (
            <Button onPress={() => handleResultPress(item.description)}>
              {item.description}
            </Button>
          )}
          style={styles.resultsList}
        />
      </View>

      {destination && (
        <View style={styles.infoContainer}>
          <Text style={styles.infoText}>{placeName}</Text>
          <View style={styles.infosubcontainer}>
            <Text style={styles.infoText}>Distance: {distance}</Text>
            <Text style={styles.infoText}>Duration: {duration}</Text>
          </View>

          <ScrollView style={styles.stepsContainer}>
            {instructions.map((step, index) => (
              <View key={index} style={styles.stepItem}>
                <Text>{`${index + 1}. ${step.instruction}`}</Text>
                <Text>{`Distance: ${step.distance}`}</Text>
              </View>
            ))}
          </ScrollView>

          <View style={styles.buttons}>
            <Button mode="contained" onPress={() => console.log('Send to scooty')}>
              Send to scooty
            </Button>
          </View>
        </View>
      )}

      {errorMsg && <Text>{errorMsg}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  map: {
    width: '100%',
    height: '100%',
  },
  searchContainer: {
    position: 'absolute',
    top: 40,
    left: 10,
    right: 10,
    backgroundColor: 'white',
    borderRadius: 5,
    padding: 5,
    elevation: 10,
  },
  searchBar: {
    marginBottom: 10,
  },
  resultsList: {
    maxHeight: 200,
  },
  infoContainer: {
    position: 'absolute',
    bottom: 20,
    left: 10,
    right: 10,
    backgroundColor: 'white',
    padding: 20,
    borderRadius: 5,
    elevation: 5,
  },
  infosubcontainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 5,
  },
  infoText: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  stepsContainer: {
    maxHeight: 150,
    marginTop: 10,
    flex:1,
    padding:2,
    backgroundColor:'white',
  },
  stepItem: {
    marginBottom: 10,
  },
  buttons: {
    marginTop: 10,
  },
});
