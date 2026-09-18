using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;

namespace RaceGame.Api.Hubs;

[Authorize]
public sealed class RaceHub : Hub
{
    public static string GroupName(long roundId) => "round:" + roundId;

    public Task JoinRound(long roundId)
        => Groups.AddToGroupAsync(Context.ConnectionId, GroupName(roundId));

    public Task LeaveRound(long roundId)
        => Groups.RemoveFromGroupAsync(Context.ConnectionId, GroupName(roundId));
}
