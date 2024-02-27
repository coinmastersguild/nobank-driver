import React, { useState, useEffect } from 'react';
import { StyleSheet, View, Text, TextInput, TouchableOpacity, FlatList, Alert } from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import * as Location from 'expo-location';
import Header from '../components/Header';
import Footer from '../components/Footer';
import { randomBytes, Mnemonic, Wallet, JsonRpcProvider, formatUnits } from 'ethers';
import * as ethers from 'ethers';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Events from "@pioneer-platform/pioneer-events";
import axios from "axios";
let QUERY_KEY = 'tester-mm-mobile2'
const apiClient = axios.create({
    baseURL: spec, // Your base URL
    headers: {
        'Authorization':  QUERY_KEY// Replace 'YOUR_AUTH_TOKEN' with your actual token
    }
});
// let spec = "https://cash2btc.com/spec/swagger.json"
let spec = "https://cash2btc.com/api/v1"
let PIONEER_WS = 'wss://cash2btc.com'
let USDT_CONTRACT_POLYGON = "0xc2132d05d31c914a87c6611c10748aeb04b58e8f"
const service = "https://polygon.rpc.blxrbdn.com"

export default function Home({ navigation, GlobalState }) {
    const { } = GlobalState;
    const [mnemonic, setMnemonic] = useState('');
    const [address, setAddress] = useState('');
    const [location, setLocation] = useState(null);

    let getBalance = async function(){
        try{
            console.log("getBalance: ")



        }catch(e){
            console.error(e)
        }
    }

    let onStart = async function(){
        try{
            console.log("onStart")
            let { status } = await Location.requestForegroundPermissionsAsync();
            if (status !== 'granted') {
                Alert.alert('Permission to access location was denied');
                return;
            }
            let location = await Location.getCurrentPositionAsync({});
            setLocation({
                latitude: location.coords.latitude,
                longitude: location.coords.longitude,
                latitudeDelta: 0.0922,
                longitudeDelta: 0.0421,
            });

            //
            let storedMnemonic = await AsyncStorage.getItem('mnemonic');
            if(storedMnemonic){
                setMnemonic(storedMnemonic);
            } else {
                const randomEntropyBytes = ethers.randomBytes(16); // 128-bit entropy
                console.log("randomEntropyBytes: ", randomEntropyBytes);
                // console.log("newMnemonic: ", Mnemonic.fromEntropy(randomEntropyBytes))
                let newMnemonic = Mnemonic.fromEntropy(randomEntropyBytes);
                AsyncStorage.setItem('mnemonic', newMnemonic.phrase);
                storedMnemonic = newMnemonic.phrase
                setMnemonic(storedMnemonic)
            }
            // Create wallet from the mnemonic
            // console.log("ethers: ", ethers);
            const wallet = Wallet.fromPhrase(storedMnemonic);
            console.log("Wallet address: ", wallet.address);
            setAddress(wallet.address);

            //get balance
            // The ABI for the methods we want to interact with
            const minABI = [
                // balanceOf
                {
                    "constant":true,
                    "inputs":[{"name":"_owner","type":"address"}],
                    "name":"balanceOf",
                    "outputs":[{"name":"balance","type":"uint256"}],
                    "type":"function"
                },
                // decimals
                {
                    "constant":true,
                    "inputs":[],
                    "name":"decimals",
                    "outputs":[{"name":"","type":"uint8"}],
                    "type":"function"
                }
            ];
            // Assuming a provider is set up (e.g., ethers.getDefaultProvider or other)
            const provider = new JsonRpcProvider(service);

            // Create a new instance of a Contract
            const newContract = new ethers.Contract(USDT_CONTRACT_POLYGON, minABI, provider);

            // Now using ethers to call contract methods
            const decimals = await newContract.decimals();
            const balanceBN = await newContract.balanceOf(wallet.address);

            // Since ethers.js returns BigNumber, you need to format it considering the token's decimals
            // Use the formatUnits utility function to convert the balance to a human-readable format
            const tokenBalance = formatUnits(balanceBN, decimals);

            // Convert balanceBN from a BigNumber to a number, considering the decimals
            // const tokenBalance = balanceBN.div(ethers.BigNumber.from(10).pow(decimals)).toNumber();
            console.log("tokenBalance: ", tokenBalance);


            let GLOBAL_SESSION = new Date().getTime()
            //@SEAN MAKE THIS ADJUSTABLE
            let TERMINAL_NAME = "local-app-nobankmm"
            let config = {
                queryKey:QUERY_KEY,
                username:TERMINAL_NAME,
                wss:PIONEER_WS
            }

            const statusLocal = await axios.get(
                spec+ "/bankless/info"
            );
            console.log("statusLocal: ", statusLocal.data);

            //sub ALL events
            let clientEvents = new Events.Events(config)
            clientEvents.init()
            clientEvents.setUsername(config.username)

            //get terminal info
            let terminalInfo = await apiClient.get(spec+ "/bankless/terminal/"+TERMINAL_NAME);
            console.log("terminalInfo: ", terminalInfo.data);

            let rate
            let TOTAL_CASH = 100
            let TOTAL_DAI = 100
            if(TOTAL_CASH == 0 || TOTAL_DAI == 0){
                rate = "0"
            } else {
                rate = (TOTAL_CASH / TOTAL_DAI)
            }

            if(!terminalInfo.data){
                //register
                let terminal = {
                    terminalId:TERMINAL_NAME+":"+wallet.address,
                    terminalName:TERMINAL_NAME,
                    tradePair: "USD_DAI",
                    rate,
                    captable:[],
                    sessionId: GLOBAL_SESSION,
                    TOTAL_CASH:TOTAL_CASH.toString(),
                    TOTAL_DAI:TOTAL_DAI.toString(),
                    pubkey:wallet.address,
                    fact:"",
                    location:[ 4.5981, -74.0758 ] //@SEAN get real location
                }
                //clear session
                console.log("REGISTERING TERMINAL: ",terminal)
                let respRegister = await apiClient.post(
                    spec+"/bankless/terminal/submit",
                    terminal
                );
                console.log("respRegister: ",respRegister.data)
            } else {
                //update
                let update = {
                    sessionId: GLOBAL_SESSION,
                    terminalName:TERMINAL_NAME,
                    pubkey:wallet.address,
                    rate,
                    TOTAL_CASH:TOTAL_CASH.toString(),
                    TOTAL_DAI:TOTAL_DAI.toString(),
                    captable:[],
                    location:[ 4.5981, -74.0758 ]
                }
                let respRegister = await apiClient.post(
                    spec+"/bankless/terminal/update",
                    update
                );
                console.log("respRegister: ",respRegister.data)
            }

            //on events
            //sub to events
            clientEvents.events.on('message', async (event) => {
                let tag = TAG + " | events | "
                try{

                    //is online
                    //TODO push location

                    //if match
                    if(event.payload && event.payload.type == "match"){
                        //handle match
                        console.log(tag,"event: ",event)
                    }

                    //LP stuff
                    if(event.payload && (event.payload.type == "lpAdd" || event.payload.type == "lpAddAsym")){
                        console.log(tag,"event: ",event)
                    }
                    if(event.payload && (event.payload.type == "lpWithdrawAsym" || event.payload.type == "lpWithdraw")){
                        console.log(tag,"event: ",event)
                    }

                }catch(e){
                    console.error(e)
                }
            })

        }catch(e){
            console.error(e)
        }
    }

    useEffect(() => {
        onStart()
    }, []);

/*    useEffect(() => {
       setToDoList(prevState => [...prevState, { id: 2, task: 'go to bed' }])
   }, [])
    const renderItem = ({ item }) => {
        return (
            <TouchableOpacity
                style={styles.task}
                onPress={() => handleChooseTask(item)}
            >
                <Text>{item.task}</Text>
            </TouchableOpacity>
        )
    }

    const handleSaveTask = () => {
        const index = toDoList.length + 1;

        setToDoList(prevState => [...prevState, { id: index, task: task }]);

        setTask('');
    }

    const handleChooseTask = (item) => {
        setChosenTask(item);
        navigation.navigate('ChosenTask');
    }*/

    const goToLiquidityPage = () => {
        navigation.navigate('Liquidity');
    }

    return (
        <View style={styles.screen}>
            <Header />
            <View style={styles.body}>
                <TouchableOpacity
                    style={styles.button}
                    onPress={() => goToLiquidityPage()}
                >
                    <Text style={styles.buttonText} >Generate Wallet</Text>
                </TouchableOpacity>
                <TouchableOpacity
                    style={styles.button}
                    onPress={() => goToLiquidityPage()}
                >
                    <Text style={styles.buttonText} >Set Liquidity</Text>
                </TouchableOpacity>
            </View>
            <View style={styles.body}>
                <MapView style={styles.map} initialRegion={location}>
                    {location && <Marker coordinate={location} title="You are here" description="Your location" />}
                </MapView>
            </View>
            <Footer navigation={navigation} />
        </View>
    )
}

const styles = StyleSheet.create({
    screen: {
        flex: 1,
        backgroundColor: '#fff',
        alignItems: 'center',
        justifyContent: 'center'
    },
    body: {
        flex: 8,
        width: '100%',
        backgroundColor: '#14141410'
    },
    task: {
        backgroundColor: 'white',
        padding: 10,
        margin: 10,
        borderRadius: 12,
        shadowColor: "#000",
        shadowOffset: {
            width: 0,
            height: 2,
        },
        shadowOpacity: 0.23,
        shadowRadius: 2.62,
        elevation: 4,
    },
    button: {
        alignItems: 'center',
        backgroundColor: '#1ccb1b',
        padding: 15,
        paddingTop: 10,
        paddingBottom: 10,
        margin: 10,
        marginBottom: 30,
        borderRadius: 12,
        shadowColor: "#29d522",
        shadowOffset: {
            width: 0,
            height: 2,
        },
        shadowOpacity: 0.23,
        shadowRadius: 2.62,
        elevation: 4,
    },
    buttonText: {
        color: 'white',
        fontWeight: '900'
    },
    map: {
        width: '100%',
        height: '80%',
    }
})
