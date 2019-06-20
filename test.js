//cluster_launcher.js


async function tt() {
    console.log(1);
}

function ttt() {

    let r = setTimeout(async () => {
        console.log(1);
        return true;
    }, 5 * 1000);
    console.log(r);
}

console.log("last", ttt());
